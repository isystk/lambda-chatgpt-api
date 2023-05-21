import express, { Application, Request, Response } from 'express'
import cors from 'cors'
import session from './session'
// メール送信を利用する場合
// import { SmtpClient } from './smtp-client'
// const mailClient = new SmtpClient()
import crypto from 'crypto'
import { DynamoDBClient, type DynamoDBRecord } from './dynamodb-client.js'
const postsClient = new DynamoDBClient('lambda_chatgpt_api_posts')
import {
  Configuration,
  OpenAIApi,
  ChatCompletionRequestMessageRoleEnum,
  ChatCompletionRequestMessage,
} from 'openai'
import { isArray, isObject, isString } from 'lodash'
import fs from 'fs'
import { storage } from './storage'

type MulterRequest = {
  files: Express.Multer.File[]
} & Request

const app: Application = express()
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(
  cors({
    origin: '*', //アクセス許可するオリジン
    credentials: true, //レスポンスヘッダーにAccess-Control-Allow-Credentials追加
    optionsSuccessStatus: 200, //レスポンスstatusを200に設定
  })
)
session(app)

const upload = storage()

const OPENAPI_SECRET = process.env.OPENAPI_SECRET ?? ''

type RequestParam = {
  message: string | ChatCompletionRequestMessage[]
  system: string | undefined
  appId: string | undefined
  contextTime: number | undefined
  userKey: string | undefined
}

type Post = {
  app_id: string
  user_key: string
} & DynamoDBRecord &
  ChatCompletionRequestMessage

app.post('/post', async (req: Request, res: Response) => {
  try {
    const { message, system, appId, contextTime, userKey }: RequestParam = {
      message: req.body['message'],
      system: req.body['system'],
      appId: req.body['appId'],
      contextTime: req.body['contextTime'],
      userKey: req.body['userKey'],
    }
    let pastMessages: ChatCompletionRequestMessage[] = []
    let messages: ChatCompletionRequestMessage[] = []
    if (isString(message)) {
      messages = [
        { role: ChatCompletionRequestMessageRoleEnum.User, content: message },
      ]
    } else if (isArray(message)) {
      messages = [
        ...message.map((e) => {
          if (!isObject(e) || !isString(e.role) || !isString(e.content)) {
            throw new Error('An unexpected error has occurred.')
          }
          if ('system' === e.role) {
            return {
              role: ChatCompletionRequestMessageRoleEnum.System,
              content: e.content,
            } as ChatCompletionRequestMessage
          }
          if ('user' === e.role) {
            return {
              role: ChatCompletionRequestMessageRoleEnum.User,
              content: e.content,
            } as ChatCompletionRequestMessage
          }
          if ('assistant' === e.role) {
            return {
              role: ChatCompletionRequestMessageRoleEnum.Assistant,
              content: e.content,
            } as ChatCompletionRequestMessage
          }
          throw new Error('An unexpected error has occurred.')
        }),
      ]
    }
    if (0 === messages.length) {
      throw new Error('message is required')
    }

    if (contextTime) {
      // コンテキストを利用する場合

      if (!appId) {
        // コンテキストを利用する場合はアプリケーションIDが必須
        throw new Error('appId is required to use a session')
      }

      if (!userKey) {
        // コンテキストを利用する場合はユーザーを一意に特定するキーが必須
        throw new Error('userKey is required to use a session')
      }

      // ユーザーの指定時間分の投稿を取得する
      const pk = crypto
        .createHash('sha256')
        .update(`${appId}-${userKey}`)
        .digest('hex')
      const hourAgo = new Date(new Date().getTime() - contextTime).getTime()
      const posts = await postsClient.query<Post>(
        'pk = :pk and sk >= :sk',
        undefined,
        undefined,
        {
          ':pk': pk,
          ':sk': hourAgo,
        }
      )

      if (posts) {
        pastMessages = posts
          .sort(function (a, b) {
            return a.created_at < b.created_at ? -1 : 1
          })
          .map(({ role, content }) => {
            return {
              role,
              content,
            } as ChatCompletionRequestMessage
          })
      }

      // 投稿履歴にユーザの質問を登録する
      for (const message of messages) {
        const pk = crypto
          .createHash('sha256')
          .update(`${appId}-${userKey}`)
          .digest('hex')
        const post = await postsClient.create<Post>({
          pk,
          sk: new Date().getTime(),
          app_id: appId,
          user_key: userKey,
          role: message.role,
          content: message.content,
        } as Post)
        console.log(
          `Post created. pk:${post.pk} sk:${post.sk} role:${post.role} content:${post.content}`
        )
      }
    }

    // OpenAIにリクエストします
    const reply = await callOpenai([
      {
        role: ChatCompletionRequestMessageRoleEnum.System,
        content: system ?? 'あなたは有能なアシスタントです。',
      },
      ...pastMessages,
      ...messages,
    ])

    if (contextTime) {
      // コンテキストを利用する場合

      if (!appId) {
        // コンテキストを利用する場合はアプリケーションIDが必須
        throw new Error('appId is required to use a session')
      }
      if (!userKey) {
        // コンテキストを利用する場合はユーザーを一意に特定するキーが必須
        throw new Error('userKey is required to use a session')
      }

      // 投稿履歴にGPTの返答を登録する
      const pk = crypto
        .createHash('sha256')
        .update(`${appId}-${userKey}`)
        .digest('hex')
      const post = await postsClient.create<Post>({
        pk,
        sk: new Date().getTime(),
        app_id: appId,
        user_key: userKey,
        role: ChatCompletionRequestMessageRoleEnum.Assistant,
        content: reply,
      } as Post)
      console.log(
        `Post created. pk:${post.pk} sk:${post.sk} role:${post.role} content:${post.content}`
      )
    }

    res.send({
      status: 200,
      message: reply,
    })
  } catch (e: unknown) {
    console.error('error', e)
    let message
    if (e instanceof Error) {
      message = e.message
    }
    res.status(500).json({
      message,
    })
  }
})

app.post(
  '/audioToText',
  upload.single('file'),
  // @ts-ignore
  async (req: MulterRequest, res: Response) => {
    if (!req.file) {
      throw new Error('file is required')
    }
    try {
      // OpenAIにリクエストします
      const configuration = new Configuration({
        apiKey: OPENAPI_SECRET,
      })
      const openai = new OpenAIApi(configuration)
      // whisper APIを呼ぶ
      const response = await openai.createTranscription(
        // @ts-ignore
        fs.createReadStream(req.file.path),
        'whisper-1',
        undefined,
        'text'
      )
      const reply = response.data
      console.log('response from openai:', reply)

      res.send({
        status: 200,
        message: reply,
      })
    } catch (e: unknown) {
      console.error('error', e)
      let message
      if (e instanceof Error) {
        message = e.message
      }
      res.status(500).json({
        message,
      })
    } finally {
      // ファイルを削除する
      fs.unlinkSync(req.file.path)
    }
  }
)

// OpenAIにリクエストします。
const callOpenai = async (messages: Array<ChatCompletionRequestMessage>) => {
  const configuration = new Configuration({
    apiKey: OPENAPI_SECRET,
  })
  const openai = new OpenAIApi(configuration)
  console.log('request to openai:', messages)
  // Chat completions APIを呼ぶ
  const response = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo',
    messages,
  })
  const message = response.data.choices[0]?.message?.content
  console.log('response from openai:', message)
  return message
}

// 404エラーハンドリング
app.use((_req, res, _next) => {
  res.status(404).send('404 Not Found').end()
})

export { app }

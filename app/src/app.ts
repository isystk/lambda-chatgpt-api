import express, { Application, Request, Response } from 'express'
import cors from 'cors'
import { DynamoDBClient } from './dynamodb-client.js'
const postsClient = new DynamoDBClient('openai_gpt_api_posts')
import {
  Configuration,
  OpenAIApi,
  ChatCompletionRequestMessageRoleEnum,
  ChatCompletionRequestMessage,
} from 'openai'
import { isArray, isObject, isString } from 'lodash'

const app: Application = express()
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(cors())

const OPENAPI_SECRET = process.env.OPENAPI_SECRET ?? ''

type RequestParam = {
  message: string | ChatCompletionRequestMessage[]
  appId: string | undefined
  sessionTime: number | undefined
  userKey: string | undefined
}

// type Post = {
//   id: string,
//   created_at: number,
//   data: PostData
// }

type PostData = {
  user_key: string
  app_id: string
} & ChatCompletionRequestMessage

app.post('/post', async (req: Request, res: Response) => {
  try {
    const { message, appId, sessionTime, userKey }: RequestParam = {
      message: req.body['message'],
      appId: req.body['appId'],
      sessionTime: req.body['sessionTime'],
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

    if (sessionTime) {
      // セッションを利用する場合

      if (!appId) {
        // セッションを利用する場合はアプリケーションIDが必須
        throw new Error('appId is required to use a session')
      }

      if (!userKey) {
        // セッションを利用する場合はユーザーを一意に特定するキーが必須
        throw new Error('userKey is required to use a session')
      }

      // 全ユーザーの1時間分の投稿を取得する
      const now = new Date() // 現在の日時を取得
      const hourAgo = new Date(now.getTime() - sessionTime).getTime()
      const allUserPosts = await postsClient.findWhere(hourAgo)

      if (allUserPosts) {
        pastMessages = allUserPosts
          .filter((e) => {
            return e.user_key === userKey
          })
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
        const post = await postsClient.post({
          app_id: appId,
          user_key: userKey,
          role: message.role,
          content: message.content,
        } as PostData)
        console.log(
          `Post created. id:${post.id} app_id:${appId} user_key:${userKey} role:${message.role} content:${message.content}`
        )
      }
    }

    // OpenAIにリクエストします
    const reply = await callOpenai([...pastMessages, ...messages])

    if (sessionTime) {
      // セッションを利用する場合

      if (!appId) {
        // セッションを利用する場合はアプリケーションIDが必須
        throw new Error('appId is required to use a session')
      }
      if (!userKey) {
        // セッションを利用する場合はユーザーを一意に特定するキーが必須
        throw new Error('userKey is required to use a session')
      }

      // 投稿履歴にGPTの返答を登録する
      const post = await postsClient.post({
        app_id: appId,
        user_key: userKey,
        role: ChatCompletionRequestMessageRoleEnum.Assistant,
        content: reply,
      } as PostData)
      console.log(
        `Post created. id:${post.id} app_id:${appId} user_key:${userKey} role:${ChatCompletionRequestMessageRoleEnum.Assistant} content:${reply}`
      )
    }

    res.send({
      status: 200,
      message: reply,
    })
  } catch (e: unknown) {
    console.error('error', e)
    let message = ''
    if (e instanceof Error) {
      message = e.message
    }
    res.sendStatus(500).json({
      status: 500,
      message,
    })
  }
})

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

export { app }

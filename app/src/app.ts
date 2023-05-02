import express, { Application, Request, Response } from 'express'
import cors from 'cors'
import {
  Configuration,
  OpenAIApi,
  ChatCompletionRequestMessageRoleEnum,
} from 'openai'

const app: Application = express()
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(cors())

const OPENAPI_SECRET = process.env.OPENAPI_SECRET ?? ''

app.post('/post', async (req: Request, res: Response) => {
  console.log('start')

  try {
    // OpenAIにリクエストします
    const reply = await callOpenai(req.body)

    res.send({
      status: 200,
      message: reply,
    })
    console.log('success')
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
const callOpenai = async (mentionMessages: []) => {
  const configuration = new Configuration({
    apiKey: OPENAPI_SECRET,
  })
  const openai = new OpenAIApi(configuration)
  const messages = [
    {
      role: ChatCompletionRequestMessageRoleEnum.System,
      content: 'あなたは有能なアシスタントです。',
    },
    ...mentionMessages,
  ]
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

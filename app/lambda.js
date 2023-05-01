import * as serverlessExpress from '@vendia/serverless-express'
import {app} from './app.js'

const server = serverlessExpress.createServer(app)

exports.handler = (event, context) => serverlessExpress.proxy(server, event, context)
import serverlessExpress from '@vendia/serverless-express'
import {app} from './app.js'

exports.handler = serverlessExpress({app})
import DynamoDB from 'aws-sdk/clients/dynamodb'
import uuid from 'node-uuid'
class DynamoDBClient {
  private documentClient: DynamoDB.DocumentClient
  constructor(private readonly tableName: string) {
    const isLocal = process.env.IS_LOCAL
    let config: Record<never, never> = { region: 'ap-northeast-1' }
    if (isLocal) {
      config = {
        ...config,
        endpoint: 'http://localhost:8000',
        credentials: { accessKeyId: 'FAKE', secretAccessKey: 'FAKE' },
      }
    }

    this.documentClient = new DynamoDB.DocumentClient(config)
    this.tableName = tableName
  }

  async findWhere(createdAt: number | undefined) {
    const condition: DynamoDB.DocumentClient.ScanInput = {
      TableName: this.tableName,
    }

    if (createdAt) {
      condition['FilterExpression'] = 'created_at >= :createdAt'
      condition['ExpressionAttributeValues'] = { ':createdAt': createdAt }
    }

    // console.log('findWhere Condition', condition)
    const { Items: result } = await this.documentClient
      .scan(condition)
      .promise()
    // console.log('findWhere Result', result)
    return result
  }
  async find(id: string) {
    const dbParams = {
      TableName: this.tableName,
      Key: {
        id,
      },
    }
    const result = await this.documentClient.get(dbParams).promise()
    return result.Item
  }

  async post(itemParams: Record<never, never>) {
    const dbParams = {
      TableName: this.tableName,
      Item: {
        id: uuid.v4(),
        ...itemParams,
        created_at: new Date().getTime(),
        updated_at: new Date().getTime(),
      },
    }

    // console.log("post", dbParams)
    await this.documentClient.put(dbParams).promise()
    return dbParams.Item
  }

  async put(id: string, itemParams: Record<never, never>) {
    const dbParams = {
      TableName: this.tableName,
      Item: {
        id,
        ...itemParams,
        updated_at: new Date().getTime(),
      },
    }

    // console.log("put", dbParams)
    await this.documentClient.put(dbParams).promise()
    return dbParams.Item
  }

  async delete(id: string) {
    const dbParams = {
      TableName: this.tableName,
      Key: {
        id,
      },
    }
    await this.documentClient.delete(dbParams).promise()
    return { id }
  }
}

export { DynamoDBClient }

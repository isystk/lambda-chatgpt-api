import DynamoDB from 'aws-sdk/clients/dynamodb'

export type DynamoDBRecord = {
  pk: string
  sk: number
  created_at: string
  updated_at: string
}

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

  async scan(
    filter: string,
    attributeNames: Record<never, never>,
    attributeValues: Record<never, never>
  ) {
    const params: DynamoDB.DocumentClient.ScanInput = {
      TableName: this.tableName,
    }
    if (filter) {
      params['FilterExpression'] = filter
    }
    if (attributeNames) {
      params['ExpressionAttributeNames'] = attributeNames
    }
    if (attributeValues) {
      params['ExpressionAttributeValues'] = attributeValues
    }

    // console.log('query Condition', params)
    const { Items: result } = await this.documentClient.scan(params).promise()
    // console.log('query Result', result)
    return result
  }

  async query<T>(
    keyCondition: string,
    filter: string | undefined,
    attributeNames: Record<never, never> | undefined,
    attributeValues: Record<never, never>
  ) {
    const params: DynamoDB.DocumentClient.QueryInput = {
      TableName: this.tableName,
    }
    params['KeyConditionExpression'] = keyCondition
    if (filter) {
      params['FilterExpression'] = filter
    }
    if (attributeNames) {
      params['ExpressionAttributeNames'] = attributeNames
    }
    params['ExpressionAttributeValues'] = attributeValues

    console.log('query Condition', params)
    const { Items } = await this.documentClient.query(params).promise()
    console.log('query Result', Items)
    return Items?.map((e) => {
      return { ...e } as T
    })
  }

  async find<T>(pk: string) {
    const dbParams = {
      TableName: this.tableName,
      Key: {
        pk,
      },
    }
    const result = await this.documentClient.get(dbParams).promise()
    return { ...result.Item } as T
  }

  async post<T extends DynamoDBRecord>(itemParams: T) {
    const timestamp = new Date().toISOString()
    const dbParams = {
      TableName: this.tableName,
      Item: {
        ...itemParams,
        created_at: timestamp,
        updated_at: timestamp,
      },
    }

    // console.log("post", dbParams)
    await this.documentClient.put(dbParams).promise()
    return dbParams.Item
  }

  async put<T>(pk: string, itemParams: T) {
    const timestamp = new Date().toISOString()
    const dbParams = {
      TableName: this.tableName,
      Item: {
        pk,
        ...itemParams,
        updated_at: timestamp,
      },
    }

    // console.log("put", dbParams)
    await this.documentClient.put(dbParams).promise()
    return dbParams.Item
  }

  async delete(pk: string) {
    const dbParams = {
      TableName: this.tableName,
      Key: {
        pk,
      },
    }
    await this.documentClient.delete(dbParams).promise()
    return { pk }
  }
}

export { DynamoDBClient }

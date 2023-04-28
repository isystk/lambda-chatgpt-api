const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

const OPENAPI_CHAT_COMPLETIONS_API = 'https://api.openai.com/v1/chat/completions'
const OPENAPI_SECRET = process.env.OPENAPI_SECRET;

app.post('/post', async (req, res) => {

    const body = JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
            req.body,
        ],
    })

    const response = await fetch(OPENAPI_CHAT_COMPLETIONS_API, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,PUT,POST,DELETE",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, access_token",
            Authorization: `Bearer ${OPENAPI_SECRET}`,
        },
        body,
    })
    const data = await response.json()
    console.log('🚀 ~ file: openai-lambda.md:76 ~ data:', data)
    
    res.json(data);
})

module.exports = app

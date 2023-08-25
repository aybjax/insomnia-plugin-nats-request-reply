// For help writing plugins, visit the documentation to get started:
//   https://docs.insomnia.rest/insomnia/introduction-to-plugins

// TODO: Add plugin code here...

const bufferToJsonObj = buf => JSON.parse(buf.toString('utf-8'));
const jsonObjToBuffer = obj => Buffer.from(JSON.stringify(obj), 'utf-8');
const { connect, Empty, StringCodec } = require("nats");

module.exports.requestHooks = [
    async function (context) {
        const route = /^(https?:\/\/)?nats(:([a-zA-Z0-9\-_]+))?(:\d+)\/(.+)$/.exec(context.request.getUrl());

        if(!route) {
            return
        }
        
        console.log('route is nats')

        const url = route[3] ?? 'localhost'
        const port = route[4] ?? ':4222'
        const queue = route[5];
        context.request.addHeader('url', url)
        context.request.addHeader('port', port)
        context.request.addHeader('queue', queue)
        context.request.addHeader('body', JSON.stringify(context.request.getBody().text))

        context.request.setBody({})
        context.request.setMethod('GET')
        context.request.setUrl(`https://google.com`)
    }
]

module.exports.responseHooks = [
    async function (context) {
        if(context.request.getUrl() !== 'https://google.com') {
            console.log('route is not nats')

            return
        }

        const url = context.request.getHeader('url')
        const port = context.request.getHeader('port')
        const queue = context.request.getHeader('queue')
        const body = context.request.getHeader('body')

        console.log({
            url, port, queue, body
        })

        const nc = await connect({ servers: `${url}${port}` });

        // create an encoder
        const sc = StringCodec();
        let response = {};

        // the client makes a request and receives a promise for a message
        // by default the request times out after 1s (1000 millis) and has
        // no payload.
        await nc.request(queue, JSON.parse(body), { timeout: 1000 })
        .then((m) => {
            console.log(`got response: ${sc.decode(m.data)}`);
            context.response.setBody(sc.decode(m.data))
        })
        .catch((err) => {
            console.log(`problem with request: ${err.message}`);
            context.response.setBody(JSON.stringify({
                error: err
            }))
        });

        await nc.close();

        console.log('request hook end')
    }
]

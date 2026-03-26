const WebSocket = require('ws');
const msgpack = require('@msgpack/msgpack');

// WebSocket URL with updated access token
const wsUrl = 'wss://crash.sanorth-001-streaming-001.splitthepot.games/hubs/def-p5-r3?access_token=eyJhbGciOiJSUzI1NiIsImtpZCI6IkZ6NnoxazlGcUlaNDRmaVFMQXBwN18tOHdjRG93T0FCTmRxVzVKcEt4U0kiLCJ0eXAiOiJKV1QifQ.eyJpZCI6IjI5OTczMzYzIiwiYnJhbmQiOiJCRVRJS0EtS0UiLCJuYW1lIjoiMjU0NzkzWFhYNDk0IiwiZGlzcGxheU5hbWUiOiIyNTQ3OTNYWFg0OTQiLCJpc3MiOiJTVFAuU2Vzc2lvbkFwaSIsImF1ZCI6IlNUUC5QbGF5ZXIiLCJleHAiOjE3NzQ2MDk2MjAsImV4dHRva2VuIjoiZGQyNTFmYmI5ZTI2MWJlNGY1ZjdmMWEyNmEwZmVhNGY5N2IzZjljNmY4ZjIzMjM3ZmIxZmY3MzliZmExYTQ0NWE0ZWI3ZmNmZWQxZWJlOTkzNmNmYmU3ZGQ4NDE4MjE1ZjQ1MDc3M2RkN2Y0NmY5MTUwNThhYWZhIiwiY3VyIjoiS0VTIiwiaWF0IjoxNzc0NTM3NjIwLCJuYmYiOjE3NzQ1Mzc2MjB9.qzRiUIEPVQTGR2dUUfP7wEM0ty9Oi7IsmOuN9FAtAlil0mU3sfvMyFr1j4YFJlcXl9kYjCaY1oYw9BDF5jCKpD4N-6Se-0JH2W5tzd60ly5STLgvoSsQlp3OsbUrLADr6rurtV7ASbnIxA4bQZdc6Qyu02qbEPj3twNdxTORdpzhgHXoU1rS_OSJOFpptApLyfcxdAvnbvmAOuNpb7RSjAqbEcEsXbhhWYWCK8-z0lzenJzoKJ8PUR1wn6FBIWM6rxomm7lAHatFV-w3ux8OmhOBSUj8ugCqfamUJPwZxvwIivEmBNqEzlAaNrhb1ArV613UrMDJ3SyA8a1FTbRTyRkum06yM8Z0D0pcXUMRKV0hnIxQiOrSfmtp0R2Jyhu4T8ttWqSzdKyh0cIp88pUqi73xex0QRLjvrtQyd9OWtsxMcChZhiTvRvpymQRut3oBepumGOB-V-iOh_J3GaW8DnlHzBatkdWNJoD4Xwvc3XfRoBz_OScRxGd2Xo3GGpa';

const headers = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  'Origin': 'https://splitthepot.games',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache'
};

let ws;
let buffer = Buffer.alloc(0);
let isHandshakeComplete = false;
let lastPingTime = Date.now();

const RECORD_SEPARATOR = 0x1e;

// Exact messages from Chrome (base64)
const CHROME_JOIN_MESSAGE = 'UJUBgKEwpGpvaW6RhKZnYW1lSWSlY3Jhc2itY2xpZW50VmVyc2lvbqcxLjEuNDk4sWJyb2FkY2FzdE9ubHlDb3JlwqxmZWF0dXJlRmxhZ3OQ';
// This is likely the ping message Chrome sends (type 6)
const CHROME_PING_MESSAGE = 'gaR0eXBlBh4='; // Base64 of { type: 6 } + record separator

function connect() {
    ws = new WebSocket(wsUrl, {
        headers: headers,
        perMessageDeflate: false
    });

    ws.on('open', function open() {
        console.log('\n✅ Connected');
        console.log('='.repeat(60));
        buffer = Buffer.alloc(0);
        
        // Send handshake
        const handshake = '{"protocol":"messagepack","version":1}' + String.fromCharCode(RECORD_SEPARATOR);
        console.log('📤 Handshake');
        ws.send(handshake);
    });

    ws.on('message', function incoming(data, isBinary) {
        buffer = Buffer.concat([buffer, data]);
        
        let start = 0;
        for (let i = 0; i < buffer.length; i++) {
            if (buffer[i] === RECORD_SEPARATOR) {
                const msg = buffer.slice(start, i);
                if (msg.length > 0) {
                    handleMessage(msg);
                }
                start = i + 1;
            }
        }
        buffer = buffer.slice(start);
    });

    ws.on('error', (e) => console.error('❌ Error:', e.message));
    ws.on('close', () => {
        console.log('\n🔌 Disconnected, reconnecting in 5s...');
        setTimeout(connect, 5000);
    });
}

function handleMessage(msg) {
    console.log(`\n📥 Received (${msg.length} bytes): ${msg.toString('base64')}`);
    
    // Try JSON
    try {
        const text = msg.toString('utf8');
        if (text.startsWith('{')) {
            const json = JSON.parse(text);
            if (Object.keys(json).length === 0) {
                console.log('✅ Handshake success!');
                isHandshakeComplete = true;
                
                // Send EXACT Chrome messages in order
                console.log('\n📤 Sending EXACT Chrome messages:');
                
                // Send join message
                const joinMsg = Buffer.from(CHROME_JOIN_MESSAGE, 'base64');
                const joinWithSep = Buffer.concat([joinMsg, Buffer.from([RECORD_SEPARATOR])]);
                console.log(`   Join: ${joinWithSep.toString('base64')}`);
                ws.send(joinWithSep);
                
                // Send ping after join
                setTimeout(() => {
                    const pingMsg = Buffer.from(CHROME_PING_MESSAGE, 'base64');
                    console.log(`   Ping: ${pingMsg.toString('base64')}`);
                    ws.send(pingMsg);
                    lastPingTime = Date.now();
                }, 100);
            }
            return;
        }
    } catch (e) {}
    
    // Try MessagePack
    try {
        const decoded = msgpack.decode(msg);
        console.log('📦 Decoded:', JSON.stringify(decoded, null, 2));
        
        if (decoded.type === 2 && decoded.item) {
            // Game data!
            console.log('\n🎮 GAME DATA:');
            if (decoded.item.multiplier) console.log(`   Multiplier: ${decoded.item.multiplier}x`);
            if (decoded.item.crashPoint) console.log(`   Crash Point: ${decoded.item.crashPoint}x`);
            if (decoded.item.gameState) console.log(`   Game State: ${decoded.item.gameState}`);
            if (decoded.item.timer) console.log(`   Timer: ${decoded.item.timer}s`);
            if (decoded.item.currentBets) console.log(`   Active Bets: ${decoded.item.currentBets.length}`);
            if (decoded.item.recentCrashes) console.log(`   Recent Crashes: ${decoded.item.recentCrashes.join(', ')}x`);
        } else if (decoded.type === 6) {
            console.log('🏓 Ping from server - sending pong');
            const pong = { type: 7 };
            const pongEncoded = msgpack.encode(pong);
            ws.send(Buffer.concat([pongEncoded, Buffer.from([RECORD_SEPARATOR])]));
        } else {
            console.log(`Type ${decoded.type}:`, decoded);
        }
    } catch (e) {
        console.log('❓ Unknown format');
    }
}

// Send pings every 25 seconds
setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN && isHandshakeComplete) {
        const now = Date.now();
        if (now - lastPingTime > 25000) {
            const pingMsg = Buffer.from(CHROME_PING_MESSAGE, 'base64');
            console.log(`\n📤 Ping: ${pingMsg.toString('base64')}`);
            ws.send(pingMsg);
            lastPingTime = now;
        }
    }
}, 25000);

connect();
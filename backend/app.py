import json
from fastapi import WebSocket, WebSocketDisconnect


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)

            # 处理语音识别消息
            if message_data.get("type") == "recognition":
                # 确保将识别结果转发给客户端
                await websocket.send_json({
                    "type": "recognition",
                    "content": message_data.get("content")
                })

                # 后续处理，例如发送到AI模型
                # ...

            # 其他消息类型处理
            # ...

    except WebSocketDisconnect:
        # 处理断开连接
        pass

import os
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import edge_tts
import asyncio
import tempfile
from openai import AsyncOpenAI
from dotenv import load_dotenv
import aiofiles
import base64
from typing import List, Dict
import json
from sse_starlette.sse import EventSourceResponse
from text2voice import TextToVoice, voice_map
import shutil
import wave
import time
from stt import STT  # 导入新的STT类

model_map = {
    "DeepSeek-V3": "deepseek-ai/DeepSeek-V3",
    "DeepSeek-R1": "deepseek-ai/DeepSeek-R1",
    "Qwen2.5-7B": "Qwen/Qwen2.5-7B-Instruct",
    "Qwen2.5-72B": "Qwen/Qwen2.5-72B-Instruct",
    "QwQ-32B": "Qwen/QwQ-32B",
}

load_dotenv()

# 初始化STT模型，替换原来的whisper模型
stt_model = STT()
# 全局配置
# 可选值: "edge_tts" 或 "fish_speech"
TTS_SERVICE = os.environ.get("TTS_SERVICE", "edge_tts")

app = FastAPI()

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 前端地址
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 初始化Whisper模型
# model = whisper.load_model("base")

# 初始化OpenAI客户端
if os.environ.get("MODEL_SERVICE") == "ollama":
    api_key = os.environ.get("OLLAMA_API_KEY")
    base_url = os.environ.get("OLLAMA_API_BASIC")
else:
    api_key = os.environ.get("OPENAI_API_KEY")
    base_url = os.environ.get("OPENAI_API_BASIC")
client = AsyncOpenAI(
    api_key=api_key,
    base_url=base_url,
)

text2voice = TextToVoice()


class TextInput(BaseModel):
    text: str
    history: List[Dict[str, str]] = []
    systemPrompt: str = "你是一个友好的AI助手。"
    voice: str = None
    model: str = "DeepSeek-V3"  # 默认使用DeepSeek-V3模型
    enableVoiceResponse: bool = True  # 添加语音回复启用状态参数


class ChatHistory(BaseModel):
    history: List[Dict[str, str]] = []
    systemPrompt: str = "你是一个友好的AI助手。"


async def generate_voice(text: str, voice: str = None) -> str:
    """
    根据配置使用不同的语音服务生成语音

    Args:
        text (str): 要转换的文本
        voice (str, optional): 指定使用的音色. Defaults to None.

    Returns:
        str: base64编码的音频数据
    """
    try:
        if TTS_SERVICE == "cosyvoice":
            # 使用 FishSpeech 服务
            if voice:
                # 从voice_map中获取实际的API音色值
                api_voice = voice_map.get(voice)
                if api_voice:
                    print(f"使用指定音色: {voice} -> {api_voice}")
                    return await text2voice.convert_async(text, api_voice)
                else:
                    print(f"未找到指定音色 {voice} 的映射，使用默认音色")
                    return await text2voice.convert_async(text)
            else:
                print(f"未指定音色，使用默认音色")
                return await text2voice.convert_async(text)
        else:
            # 使用 Edge TTS 服务
            communicate = edge_tts.Communicate(text, "zh-CN-XiaoxiaoNeural")
            with tempfile.NamedTemporaryFile(
                delete=False, suffix=".mp3"
            ) as temp_speech:
                temp_speech_path = temp_speech.name
                await communicate.save(temp_speech_path)

                # 读取生成的语音文件并转换为Base64
                async with aiofiles.open(temp_speech_path, mode="rb") as audio_file:
                    audio_content = await audio_file.read()
                    audio_base64 = base64.b64encode(audio_content).decode("utf-8")

                # 清理临时文件
                os.unlink(temp_speech_path)
                return audio_base64

    except Exception as e:
        print(f"生成语音时出错: {str(e)}")
        raise


# 添加辅助函数，构建并格式化消息内容
def build_messages(text_input, history, system_prompt):
    """构建格式化的消息列表"""
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history)
    messages.append({"role": "user", "content": text_input})
    return messages


async def get_model_id(model_name):
    """获取实际的模型ID"""
    print(f"获取模型ID: {model_name}")
    model_id = model_map.get(model_name, model_map["DeepSeek-V3"])
    if os.environ.get("MODEL_SERVICE") == "ollama":
        model_id = os.environ.get("OLLAMA_MODEL_NAME")
    print(f"实际使用模型ID: {model_id}")
    return model_id

async def generate_response(
    text_input: str,
    history: List[Dict[str, str]] = [],
    system_prompt: str = "你是一个友好的AI助手。",
    voice: str = None,
    model: str = "DeepSeek-V3",
):
    try:
        messages = build_messages(text_input, history, system_prompt)

        print(f"用户输入: {text_input}")
        print(f"系统提示词: {system_prompt}")
        print(f"历史消息: {history}")
        if voice:
            print(f"使用音色: {voice}")
        print(f"使用模型: {model}")

        # 获取模型ID
        model_id = await get_model_id(model)

        response = await client.chat.completions.create(
            messages=messages,
            model=model_id,
        )
        ai_response = response.choices[0].message.content
        print(f"AI回复: {ai_response}")

        # 使用统一的语音生成函数，传递voice参数
        audio_base64 = await generate_voice(ai_response, voice)
        return ai_response, audio_base64

    except Exception as e:
        print(f"生成回复时出错: {str(e)}")
        raise


async def generate_response_stream(
    text_input: str,
    history: List[Dict[str, str]] = [],
    system_prompt: str = "你是一个友好的AI助手。",
    voice: str = None,
    enableVoiceResponse: bool = True,
    model: str = "DeepSeek-V3",
):
    try:
        messages = build_messages(text_input, history, system_prompt)

        print(f"用户输入: {text_input}")
        print(f"系统提示词: {system_prompt}")
        print(f"历史消息: {history}")
        if enableVoiceResponse:
            print(f"使用音色: {voice}")
        else:
            print("语音回复已禁用，不生成音频")
        print(f"使用模型: {model}")

        # 获取模型ID
        model_id = await get_model_id(model)

        stream = await client.chat.completions.create(
            messages=messages,
            model=model_id,
            stream=True,
        )

        full_response = ""
        think_end = False
        think_start = False
        async for chunk in stream:
            # 检查是否有新的内容
            if chunk.choices:
                choice = chunk.choices[0]
                if (
                    "reasoning_content" in choice.delta.model_extra
                    and choice.delta.model_extra["reasoning_content"] is not None
                    and choice.delta.model_extra["reasoning_content"] != ""
                ):
                    if think_start is False:
                        print("<think>")
                        think_start = True
                        print("```")
                        yield {
                            "event": "message",
                            "data": json.dumps(
                                {"type": "text", "content": "#### 思考中... \n"}
                            ),
                        }
                    print(
                        choice.delta.model_extra["reasoning_content"], end="")
                    yield {
                        "event": "message",
                        "data": json.dumps(
                            {
                                "type": "text",
                                "content": choice.delta.model_extra["reasoning_content"],
                            }
                        ),
                    }
                if choice.delta.content:
                    if think_start is True and think_end is False:
                        print("</think>")
                        think_end = True
                        print("```")
                        yield {
                            "event": "message",
                            "data": json.dumps(
                                {
                                    "type": "text",
                                    "content": "\n #### 思考完成 \n *** \n",
                                }
                            ),
                        }
                    # 打印当前块的内容
                    if choice.delta.content is not None:
                        full_response += choice.delta.content
                        print(choice.delta.content, end="")
                        yield {
                            "event": "message",
                            "data": json.dumps(
                                {"type": "text", "content": choice.delta.content}
                            ),
                        }

        print("")
        # 使用统一的语音生成函数，传递voice参数
        # 只有在voice不为None时才生成语音
        if enableVoiceResponse:
            audio_base64 = await generate_voice(full_response, voice)
            # 发送音频数据
            yield {
                "event": "message",
                "data": json.dumps({"type": "audio", "content": audio_base64}),
            }
        else:
            print("语音回复已禁用，跳过语音生成")

    except Exception as e:
        print(f"生成回复时出错: {str(e)}")
        yield {"event": "error", "data": json.dumps({"error": str(e)})}


# 添加辅助函数，用于处理上传的音频文件
async def process_audio_file(audio: UploadFile) -> str:
    """
    处理上传的音频文件，保存为临时文件并返回文件路径

    Args:
        audio (UploadFile): 上传的音频文件

    Returns:
        str: 临时文件路径

    Raises:
        Exception: 如果文件处理失败
    """
    try:
        # 创建一个固定位置的临时目录，避免使用系统临时目录可能的权限问题
        temp_dir = os.path.join(os.getcwd(), "temp_audio")
        os.makedirs(temp_dir, exist_ok=True)

        # 生成唯一文件名
        timestamp = int(time.time())
        file_name = f"audio_{timestamp}.wav"
        file_path = os.path.join(temp_dir, file_name)

        # 读取上传的文件内容
        content = await audio.read()
        if not content:
            raise Exception("上传的音频文件为空")

        # 保存文件
        with open(file_path, "wb") as f:
            f.write(content)
            f.flush()
            os.fsync(f.fileno())

        # 验证文件
        if not os.path.exists(file_path):
            raise Exception("保存音频文件失败")

        file_size = os.path.getsize(file_path)
        if file_size == 0:
            raise Exception("保存的音频文件为空")

        print(f"已保存音频文件: {file_path}, 大小: {file_size} 字节")

        # 检查是否是有效的WAV文件
        try:
            with wave.open(file_path, "rb") as wave_file:
                frames = wave_file.getnframes()
                rate = wave_file.getframerate()
                print(f"WAV文件信息: 帧数={frames}, 采样率={rate}")
        except:
            print("不是标准WAV文件，但仍将继续处理")

        return file_path

    except Exception as e:
        print(f"处理音频文件时出错: {str(e)}")
        # 如果文件存在但处理失败，尝试删除
        if "file_path" in locals() and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except:
                pass
        raise


# 添加清理函数


def cleanup_temp_file(file_path: str):
    """安全删除临时文件"""
    try:
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
            print(f"已删除临时文件: {file_path}")
    except Exception as e:
        print(f"删除临时文件失败: {str(e)}")


# 辅助函数：处理音频请求流中的共用逻辑
async def process_audio_request(
    audio: UploadFile,
    history: str,
    systemPrompt: str,
    voice: str = None,
    model: str = "DeepSeek-V3",
    enableVoiceResponse: str = "true"
):
    temp_audio_path = None
    try:
        # 打印收到的参数
        print(f"收到音频请求参数: audio={audio.filename}, history长度={len(history)}, systemPrompt={systemPrompt}, voice={voice}, model={model}, enableVoiceResponse={enableVoiceResponse}")

        # 使用辅助函数处理音频文件
        temp_audio_path = await process_audio_file(audio)

        # 使用新的STT类进行语音识别，替换原来的whisper直接调用
        result = stt_model.transcribe(temp_audio_path)

        # 检查返回的结果
        if not result or "text" not in result:
            return None, "语音识别失败，未能获取文本结果"

        text_input = result["text"]

        # 如果识别结果包含错误提示，记录但仍继续处理
        if (
            "识别失败" in text_input
            or "暂时不可用" in text_input
            or "技术问题" in text_input
        ):
            print(f"语音识别可能出现问题: {text_input}")

        print(f"语音识别结果: {text_input}")
        print(f"语音回复启用状态: {enableVoiceResponse}")

        # 解析历史记录
        chat_history = json.loads(history)

        # 将字符串转换为布尔值
        enable_voice = enableVoiceResponse.lower() == "true"

        return text_input, chat_history, enable_voice, None

    except Exception as e:
        print(f"处理语音请求时出错: {str(e)}")
        return None, None, None, str(e)

    finally:
        # 清理临时文件
        if temp_audio_path:
            cleanup_temp_file(temp_audio_path)


@app.post("/api/chat")
async def chat(
    audio: UploadFile = File(...),
    history: str = Form("[]"),
    systemPrompt: str = Form("你是一个友好的AI助手。"),
):
    result, chat_history, _, error = await process_audio_request(
        audio, history, systemPrompt
    )

    if error:
        return {"success": False, "error": error}

    if not result:
        return {"success": False, "error": chat_history}  # 这里chat_history是错误信息

    # 生成回复
    ai_response, audio_base64 = await generate_response(
        result, chat_history, systemPrompt
    )

    return {
        "success": True,
        "text_input": result,
        "ai_response": ai_response,
        "audio_response": audio_base64,
    }


@app.post("/api/chat/text")
async def chat_text(text_input: TextInput):
    try:
        # 生成回复
        ai_response, audio_base64 = await generate_response(
            text_input.text,
            text_input.history,
            text_input.systemPrompt,
            text_input.voice,
            text_input.model,
        )

        return {
            "success": True,
            "ai_response": ai_response,
            "audio_response": audio_base64,
        }
    except Exception as e:
        print(f"处理文本请求时出错: {str(e)}")
        return {"success": False, "error": str(e)}


@app.post("/api/chat/stream")
async def chat_stream(text_input: TextInput):
    try:
        # 如果禁用了语音回复，将voice设置为None
        voice_param = text_input.voice if text_input.enableVoiceResponse else None

        return EventSourceResponse(
            generate_response_stream(
                text_input.text,
                text_input.history,
                text_input.systemPrompt,
                voice_param,
                text_input.enableVoiceResponse,
                text_input.model
            )
        )
    except Exception as e:
        print(f"处理文本请求流时出错: {str(e)}")
        return EventSourceResponse(_generate_error_stream(str(e)))


@app.post("/api/chat/audio/stream")
async def chat_audio_stream(
    audio: UploadFile = File(...),
    history: str = Form("[]"),
    systemPrompt: str = Form("你是一个友好的AI助手。"),
    voice: str = Form(None),
    model: str = Form("DeepSeek-V3"),
    enableVoiceResponse: str = Form("true"),
):
    text_input, chat_history, enable_voice, error = await process_audio_request(
        audio, history, systemPrompt, voice, model, enableVoiceResponse
    )

    if error:
        return EventSourceResponse(_generate_error_stream(error))

    if not text_input:
        return EventSourceResponse(
            _generate_error_stream(chat_history)  # 这里chat_history是错误信息
        )

    # 创建一个生成器函数，先发送用户输入，然后发送AI响应
    async def combined_stream():
        # 先发送用户的语音识别结果
        yield {
            "event": "message",
            "data": json.dumps({"type": "recognition", "content": text_input}),
        }

        # 然后生成并发送AI的回复文本
        full_response = ""
        async for event in generate_response_stream(
            text_input, chat_history, systemPrompt, voice if enable_voice else None, enable_voice, model
        ):
            # 如果这是音频事件且语音回复被禁用，则跳过
            event_data = json.loads(
                event["data"]) if "data" in event else {}
            if event_data.get("type") == "audio" and not enable_voice:
                print("语音回复已禁用，跳过音频数据")
                continue

            if event_data.get("type") == "text" and event_data.get("content"):
                full_response += event_data.get("content", "")

            yield event

    return EventSourceResponse(combined_stream())


# 辅助函数：生成错误流
async def _generate_error_stream(error_message):
    yield {"event": "error", "data": json.dumps({"error": error_message})}
    yield {
        "event": "message",
        "data": json.dumps({"type": "text", "content": f"发生错误: {error_message}"}),
    }
    yield {"event": "done", "data": json.dumps({"content": ""})}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

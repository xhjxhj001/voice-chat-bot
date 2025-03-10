import requests
import os
import whisper
from typing import Optional, Dict, Any
from dotenv import load_dotenv

load_dotenv()


class STT:
    """
    语音识别类，支持多种语音识别服务
    可通过环境变量STT_SERVICE配置使用的服务类型：
    - "whisper": 使用本地Whisper模型（默认）
    - "siliconflow": 使用SiliconFlow API
    """

    def __init__(self):
        # 从环境变量获取STT服务类型，默认为whisper
        self.stt_service = os.environ.get("STT_SERVICE", "whisper")

        # SiliconFlow API配置
        self.siliconflow_url = "https://api.siliconflow.cn/v1/audio/transcriptions"
        self.siliconflow_model = os.environ.get(
            "SILICONFLOW_MODEL", "FunAudioLLM/SenseVoiceSmall")

        # 如果使用Whisper，加载模型
        if self.stt_service == "whisper":
            self.whisper_model_size = os.environ.get(
                "WHISPER_MODEL_SIZE", "base")
            print(f"正在加载Whisper模型: {self.whisper_model_size}")
            self.whisper_model = whisper.load_model(self.whisper_model_size)
            print("Whisper模型加载完成")

    def transcribe(self, audio_file_path: str) -> Dict[str, Any]:
        """
        将音频文件转换为文本

        Args:
            audio_file_path (str): 音频文件路径

        Returns:
            Dict[str, Any]: 包含识别结果的字典，至少包含"text"键
        """
        # 检查文件是否存在
        if not os.path.exists(audio_file_path):
            return {"text": "错误：音频文件不存在", "error": True}

        # 根据配置的服务类型调用不同的转录方法
        if self.stt_service == "whisper":
            return self._transcribe_with_whisper(audio_file_path)
        elif self.stt_service == "siliconflow":
            return self._transcribe_with_siliconflow(audio_file_path)
        else:
            return {"text": f"错误：不支持的语音识别服务 {self.stt_service}", "error": True}

    def _transcribe_with_whisper(self, audio_file_path: str) -> Dict[str, Any]:
        """使用Whisper模型进行语音识别"""
        try:
            result = self.whisper_model.transcribe(audio_file_path)
            return result
        except Exception as e:
            error_msg = f"Whisper语音识别失败: {str(e)}"
            print(error_msg)
            return {"text": error_msg, "error": True}

    def _transcribe_with_siliconflow(self, audio_file_path: str) -> Dict[str, Any]:
        """使用SiliconFlow API进行语音识别"""
        try:
            # 准备请求参数
            payload = {'model': self.siliconflow_model}

            # 准备文件
            with open(audio_file_path, 'rb') as audio_file:
                files = [
                    ('file', (os.path.basename(audio_file_path), audio_file, 'audio/wav'))
                ]

                # 准备请求头
                headers = {
                    'Authorization': f'Bearer {os.environ.get("OPENAI_API_KEY")}'
                }

                # 发送请求
                response = requests.post(
                    self.siliconflow_url,
                    headers=headers,
                    data=payload,
                    files=files
                )

                # 检查响应
                if response.status_code == 200:
                    result = response.json()
                    # 确保返回的结果格式与Whisper一致
                    if isinstance(result, dict) and "text" in result:
                        return result
                    else:
                        # 转换为与Whisper一致的格式
                        return {"text": str(result)}
                else:
                    error_msg = f"SiliconFlow API请求失败: {response.status_code} - {response.text}"
                    print(error_msg)
                    return {"text": error_msg, "error": True}

        except Exception as e:
            error_msg = f"SiliconFlow语音识别失败: {str(e)}"
            print(error_msg)
            return {"text": error_msg, "error": True}

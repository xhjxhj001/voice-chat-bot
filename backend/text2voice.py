import os
import requests
import base64
import httpx

voice_map = {
    "默认音色": "FunAudioLLM/CosyVoice2-0.5B:anna",
    "妖娆女声": "speech:zh_7:cm03s5czm00m4d2xjtvw24a1z:ipzlwiaetyssioaftrpl",
    "马斯克": "speech:elon_musk:cm03s5czm00m4d2xjtvw24a1z:lztzzdlgyxuvrmmlnpvv",
    "可爱女声": "speech:cute_girl_2:cm03s5czm00m4d2xjtvw24a1z:aueuxmukjlhnyjdamduq",
}


class TextToVoice:
    def __init__(self):
        self.api_key = os.environ.get("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("环境变量 OPENAI_API_KEY 未设置")

        self.url = "https://api.siliconflow.cn/v1/audio/speech"
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _get_payload(self, text, voice="FunAudioLLM/CosyVoice2-0.5B:anna"):
        """生成API请求的通用payload"""
        return {
            "model": "FunAudioLLM/CosyVoice2-0.5B",
            "input": text,
            "voice": voice,
            "response_format": "mp3",
        }

    def _process_response(self, content):
        """处理API响应，将音频数据转换为base64"""
        return base64.b64encode(content).decode("utf-8")

    def convert(self, text, voice="FunAudioLLM/CosyVoice2-0.5B:anna"):
        """
        将文本转换为语音

        Args:
            text (str): 要转换的文本
            voice (str): 语音模型

        Returns:
            str: base64编码的音频数据
        """
        try:
            payload = self._get_payload(text, voice)
            response = requests.post(self.url, json=payload, headers=self.headers)

            if response.status_code != 200:
                raise Exception(f"语音生成失败，状态码：{response.status_code}")

            return self._process_response(response.content)
        except Exception as e:
            print(f"文字转语音过程出错: {str(e)}")
            raise

    async def convert_async(self, text, voice="FunAudioLLM/CosyVoice2-0.5B:anna"):
        """
        异步方式将文本转换为语音

        Args:
            text (str): 要转换的文本
            voice (str): 语音模型

        Returns:
            str: base64编码的音频数据
        """
        try:
            payload = self._get_payload(text, voice)

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.url, json=payload, headers=self.headers
                )

            if response.status_code != 200:
                raise Exception(f"语音生成失败，状态码：{response.status_code}")

            return self._process_response(response.content)
        except Exception as e:
            print(f"文字转语音过程出错: {str(e)}")
            raise

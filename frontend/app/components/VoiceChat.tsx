'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
    type: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

// 添加新的对话数据结构
interface Conversation {
    id: string;
    title: string;
    messages: Message[];
    systemPrompt?: string;
    createdAt: Date;
    updatedAt: Date;
}

// 添加提示组件
const HttpsWarning = ({ visible, onClose }: { visible: boolean, onClose: () => void }) => {
    if (!visible) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
                <h3 className="text-lg font-bold mb-2">需要HTTPS连接</h3>
                <p className="mb-4">
                    移动设备浏览器要求必须在HTTPS环境下才能使用麦克风录音功能。
                </p>
                <div className="mb-4">
                    <h4 className="font-semibold">解决方案:</h4>
                    <ul className="list-disc pl-5 space-y-1 mt-2">
                        <li>使用HTTPS连接访问此应用</li>
                        <li>使用桌面浏览器</li>
                        <li>使用文本输入代替语音</li>
                    </ul>
                </div>
                <div className="flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                        我知道了
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function VoiceChat() {
    const [isRecording, setIsRecording] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [systemPrompt, setSystemPrompt] = useState<string>('你是一个智能AI助手。');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [enableVoiceResponse, setEnableVoiceResponse] = useState<boolean>(true);
    const [selectedVoice, setSelectedVoice] = useState<string>('');
    const [selectedModel, setSelectedModel] = useState<string>('DeepSeek-V3'); // 添加模型选择状态
    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const audioChunks = useRef<Blob[]>([]);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const [pendingAudios, setPendingAudios] = useState<string[]>([]);
    const [isAudioPlaying, setIsAudioPlaying] = useState(false);
    const audioElementRef = useRef<HTMLAudioElement | null>(null);
    const [showPlayButton, setShowPlayButton] = useState(false);
    const [mobileHttpsWarning, setMobileHttpsWarning] = useState(false);
    // 添加输入框引用
    const inputRef = useRef<HTMLInputElement>(null);

    // 添加对话管理状态
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string>('');
    const [isConversationPanelOpen, setIsConversationPanelOpen] = useState<boolean>(false);

    // 音色选项
    const voiceOptions = [
        { label: '默认音色', value: '' },
        { label: '可爱女声', value: '可爱女声' },
        { label: '妖娆女声', value: '妖娆女声' },
        { label: '马斯克', value: '马斯克' },
    ];

    // 模型选项
    const modelOptions = [
        { label: 'DeepSeek-V3', value: 'DeepSeek-V3' },
        { label: 'DeepSeek-R1', value: 'DeepSeek-R1' },
        { label: 'Qwen2.5-7B', value: 'Qwen2.5-7B' },
        { label: 'Qwen2.5-72B', value: 'Qwen2.5-72B' },
        { label: 'QwQ-32B', value: 'QwQ-32B' },
    ];

    // 添加检查用户交互状态的变量
    const [userHasInteracted, setUserHasInteracted] = useState(false);

    // 添加HTTPS警告状态
    const [httpsWarningVisible, setHttpsWarningVisible] = useState(false);

    // 获取API基础URL
    const getApiBaseUrl = () => {
        // 使用固定的后端地址
        const host = window.location.hostname;
        return `http://${host}:8000`;
    };

    // 自动滚动到最新消息
    const scrollToBottom = () => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    };

    // 聚焦到输入框
    const focusInput = () => {
        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
            }
        }, 100);
    };

    // 将消息转换为API所需的格式
    const formatMessagesForAPI = (messages: Message[]): ChatMessage[] => {
        return messages.map(msg => ({
            role: msg.type,
            content: msg.content
        }));
    };

    // 初始化加载对话历史和设置
    useEffect(() => {
        loadConversationsFromLocalStorage();
        loadSettings();
    }, []);

    // 当当前对话有变化时保存到localStorage
    useEffect(() => {
        if (activeConversationId && messages.length > 0) {
            saveActiveConversation();
        }
    }, [messages, activeConversationId]);

    // 从localStorage加载所有对话
    const loadConversationsFromLocalStorage = () => {
        try {
            const savedConversations = localStorage.getItem('voiceChatConversations');
            if (savedConversations) {
                const parsedConversations: Conversation[] = JSON.parse(savedConversations, (key, value) => {
                    // 将字符串日期转回Date对象
                    if (key === 'timestamp' || key === 'createdAt' || key === 'updatedAt') {
                        return new Date(value);
                    }
                    return value;
                });

                setConversations(parsedConversations);

                // 如果有对话，加载最近的一个
                if (parsedConversations.length > 0) {
                    const latestConversation = parsedConversations.sort((a, b) =>
                        b.updatedAt.getTime() - a.updatedAt.getTime()
                    )[0];

                    setActiveConversationId(latestConversation.id);
                    setMessages(latestConversation.messages);
                    if (latestConversation.systemPrompt) {
                        setSystemPrompt(latestConversation.systemPrompt);
                    }
                } else {
                    // 如果localStorage中没有对话，创建新对话
                    createNewConversation();
                }
            } else {
                // 如果localStorage中没有对话，创建新对话
                createNewConversation();
            }
        } catch (error) {
            console.error('加载对话历史失败:', error);
            createNewConversation();
        }
    };

    // 保存当前活跃对话到localStorage
    const saveActiveConversation = () => {
        try {
            const updatedConversations = conversations.map(conv =>
                conv.id === activeConversationId
                    ? {
                        ...conv,
                        messages,
                        systemPrompt,
                        updatedAt: new Date(),
                        title: getConversationTitle(messages)
                    }
                    : conv
            );

            setConversations(updatedConversations);
            localStorage.setItem('voiceChatConversations', JSON.stringify(updatedConversations));
        } catch (error) {
            console.error('保存对话失败:', error);
        }
    };

    // 生成对话标题
    const getConversationTitle = (msgs: Message[]): string => {
        // 使用第一条用户消息作为标题，截取前20个字符
        const firstUserMessage = msgs.find(m => m.type === 'user');
        if (firstUserMessage && firstUserMessage.content) {
            return firstUserMessage.content.substring(0, 20) + (firstUserMessage.content.length > 20 ? '...' : '');
        }
        return `新对话 ${new Date().toLocaleString()}`;
    };

    // 创建新对话
    const createNewConversation = () => {
        const newConversation: Conversation = {
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
            title: '新对话',
            messages: [],
            systemPrompt: systemPrompt,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        setConversations(prev => [newConversation, ...prev]);
        setActiveConversationId(newConversation.id);
        setMessages([]);
    };

    // 切换到指定对话
    const switchToConversation = (conversationId: string) => {
        // 保存当前对话
        saveActiveConversation();

        // 切换到新对话
        const targetConversation = conversations.find(conv => conv.id === conversationId);
        if (targetConversation) {
            setActiveConversationId(conversationId);
            setMessages(targetConversation.messages);
            if (targetConversation.systemPrompt) {
                setSystemPrompt(targetConversation.systemPrompt);
            }

            // 关闭对话面板
            setIsConversationPanelOpen(false);
        }
    };

    // 删除对话
    const deleteConversation = (conversationId: string, e: React.MouseEvent) => {
        e.stopPropagation(); // 防止触发父元素的点击事件

        const updatedConversations = conversations.filter(conv => conv.id !== conversationId);
        setConversations(updatedConversations);
        localStorage.setItem('voiceChatConversations', JSON.stringify(updatedConversations));

        // 如果删除的是当前活跃对话，切换到第一个对话或创建新对话
        if (conversationId === activeConversationId) {
            if (updatedConversations.length > 0) {
                switchToConversation(updatedConversations[0].id);
            } else {
                createNewConversation();
            }
        }
    };

    // 修改原有的清空历史记录函数
    const clearHistory = () => {
        setMessages([]);
        // 更新当前对话为空
        const updatedConversations = conversations.map(conv =>
            conv.id === activeConversationId
                ? { ...conv, messages: [], updatedAt: new Date() }
                : conv
        );
        setConversations(updatedConversations);
        localStorage.setItem('voiceChatConversations', JSON.stringify(updatedConversations));
    };

    // 更新系统提示词
    const updateSystemPrompt = (newPrompt: string) => {
        setSystemPrompt(newPrompt);
        // 更新当前对话的系统提示词
        const updatedConversations = conversations.map(conv =>
            conv.id === activeConversationId
                ? { ...conv, systemPrompt: newPrompt, updatedAt: new Date() }
                : conv
        );
        setConversations(updatedConversations);
        localStorage.setItem('voiceChatConversations', JSON.stringify(updatedConversations));
    };

    // 检查是否为移动设备且不是HTTPS环境
    useEffect(() => {
        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isHttps = window.location.protocol === 'https:';
        if (isMobileDevice && !isHttps) {
            setMobileHttpsWarning(true);
        }
    }, []);

    // 监听用户交互，解决自动播放和媒体访问政策问题
    useEffect(() => {
        const markUserInteraction = () => {
            setUserHasInteracted(true);
            // 移除监听一次交互后
            events.forEach(event => {
                document.removeEventListener(event, markUserInteraction);
            });
        };

        // 添加用户交互事件监听
        const events = ['click', 'touchstart', 'keydown'];
        events.forEach(event => {
            document.addEventListener(event, markUserInteraction, { once: true });
        });

        return () => {
            // 清理事件监听
            events.forEach(event => {
                document.removeEventListener(event, markUserInteraction);
            });
        };
    }, []);

    const startRecording = async () => {
        try {
            // 检查浏览器是否支持媒体设备
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('您的浏览器不支持录音功能。请使用最新版本的Chrome、Firefox或Safari浏览器。');
            }

            // 检查是否为移动设备且不是HTTPS环境
            const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            if (isMobileDevice && window.location.protocol !== 'https:') {
                // 显示HTTPS警告
                setHttpsWarningVisible(true);

                // 如果在移动设备上使用HTTP，显示警告但继续尝试
                console.warn('移动设备浏览器通常要求在HTTPS环境下才能使用录音功能。');
                setMobileHttpsWarning(true);
            }

            // 添加预先请求用户权限的步骤
            try {
                // 在开始录音前先确保有麦克风权限
                await navigator.permissions.query({ name: 'microphone' as PermissionName });
            } catch (permError) {
                console.warn('无法查询麦克风权限状态:', permError);
            // 继续尝试获取媒体，因为某些浏览器不支持permissions API
            }

            // 设置更详细的音频约束
            const audioConstraints = {
                echoCancellation: { ideal: true },
                noiseSuppression: { ideal: true },
                autoGainControl: { ideal: true },
                channelCount: { ideal: 1 },
                sampleRate: { ideal: 48000 }
            };

            try {
                // 使用细粒度的错误捕获
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    audio: audioConstraints
                });

                mediaRecorder.current = new MediaRecorder(stream);
                audioChunks.current = [];

                mediaRecorder.current.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunks.current.push(event.data);
                    }
                };

                mediaRecorder.current.onstop = async () => {
                    if (audioChunks.current.length > 0) {
                        const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
                        await sendAudioToServer(audioBlob);
                    }
                };

                mediaRecorder.current.start(200); // 每200ms触发一次ondataavailable事件
                setIsRecording(true);
            } catch (mediaError) {
                // 处理媒体访问错误
                console.error('媒体访问错误:', mediaError);

                let errorMessage = '无法访问麦克风。';

                // 提供更有帮助的错误信息
                if (mediaError instanceof DOMException) {
                    switch (mediaError.name) {
                        case 'NotAllowedError':
                            errorMessage = '麦克风访问被拒绝。请在浏览器权限设置中允许访问麦克风，并刷新页面重试。';
                            break;
                        case 'NotFoundError':
                            errorMessage = '未检测到麦克风设备。请确保您的设备有可用的麦克风。';
                            break;
                        case 'AbortError':
                            errorMessage = '麦克风访问请求被中止。';
                            break;
                        case 'NotReadableError':
                            errorMessage = '无法读取麦克风。可能已被其他应用占用。';
                            break;
                        case 'OverconstrainedError':
                            errorMessage = '麦克风无法满足请求的参数要求。';
                            break;
                        case 'SecurityError':
                            errorMessage = '使用麦克风被安全策略禁止。请使用HTTPS连接。';
                            break;
                        case 'TypeError':
                            errorMessage = '媒体请求参数不正确。';
                            break;
                        default:
                            errorMessage = `麦克风访问错误: ${mediaError.name}。请确保在浏览器设置中允许麦克风访问。`;
                    }
                }

                throw new Error(errorMessage);
            }
        } catch (error) {
            console.error('录音初始化错误:', error);
            // 显示具体的错误消息给用户
            setMessages(prev => [...prev, {
                type: 'assistant',
                content: error instanceof Error ? error.message : '无法访问麦克风，请确保已授予麦克风访问权限。',
                timestamp: new Date()
            }]);
        }
    };

    const stopRecording = () => {
        if (mediaRecorder.current && isRecording) {
            mediaRecorder.current.stop();
            setIsRecording(false);
            mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
        }
    };

    // 监听音频播放队列
    useEffect(() => {
        if (pendingAudios.length > 0 && !isAudioPlaying && audioElementRef.current) {
            playNextAudio();
        }
    }, [pendingAudios, isAudioPlaying]);

    // 播放下一个音频
    const playNextAudio = () => {
        if (pendingAudios.length === 0 || !audioElementRef.current) return;

        try {
            setIsAudioPlaying(true);
            const audioSrc = pendingAudios[0];

            audioElementRef.current.src = audioSrc;
            audioElementRef.current.play()
                .catch(error => {
                    console.error('播放音频失败:', error);
                    // 如果是自动播放被阻止的错误，显示一个播放按钮给用户点击
                    if (error.name === 'NotAllowedError') {
                        showAudioPlayButton();
                    }
                });
        } catch (error) {
            console.error('设置音频源失败:', error);
            setIsAudioPlaying(false);
            setPendingAudios(prev => prev.slice(1)); // 移除失败的音频
        }
    };

    // 音频播放结束处理
    const handleAudioEnded = () => {
        // 移除已播放的音频，播放下一个
        setPendingAudios(prev => {
            const newQueue = prev.slice(1);
            if (newQueue.length > 0 && audioElementRef.current) {
                setTimeout(() => {
                    if (audioElementRef.current) {
                        audioElementRef.current.src = newQueue[0];
                        audioElementRef.current.play().catch(console.error);
                    }
                }, 100);
                return newQueue;
            } else {
                setIsAudioPlaying(false);
                return newQueue;
            }
        });
    };

    // 显示音频播放按钮（当自动播放被阻止时）
    const showAudioPlayButton = () => {
        setShowPlayButton(true);
    };

    const handleManualPlay = () => {
        if (audioElementRef.current && pendingAudios.length > 0) {
            audioElementRef.current.src = pendingAudios[0];
            audioElementRef.current.play()
                .then(() => {
                    setShowPlayButton(false);
                })
                .catch(error => {
                    console.error('手动播放音频失败:', error);
                });
        }
    };

    const playAudioResponse = async (audioBase64: string) => {
        try {
            // 如果用户禁用了语音回复，则不处理音频
            if (!enableVoiceResponse) {
                console.log('语音回复已关闭，跳过音频播放');
                return;
            }

            // 将Base64字符串转换回二进制数据
            const binaryData = atob(audioBase64);
            const arrayBuffer = new ArrayBuffer(binaryData.length);
            const uint8Array = new Uint8Array(arrayBuffer);
            for (let i = 0; i < binaryData.length; i++) {
                uint8Array[i] = binaryData.charCodeAt(i);
            }

            // 创建音频Blob并添加到队列
            const audioBlob = new Blob([uint8Array], { type: 'audio/mp3' });
            const audioUrl = URL.createObjectURL(audioBlob);

            // 将音频添加到播放队列
            setPendingAudios(prev => [...prev, audioUrl]);

            // 如果是首次用户交互后，尝试立即播放
            if (document.body.hasAttribute('data-user-interacted') && !isAudioPlaying && pendingAudios.length === 0) {
                setTimeout(() => {
                    playNextAudio();
                }, 0);
            }
        } catch (error) {
            console.error('Error processing audio:', error);
        }
    };

    // 记录用户交互状态
    useEffect(() => {
        const markUserInteraction = () => {
            document.body.setAttribute('data-user-interacted', 'true');
            // 尝试播放未播放的音频
            if (pendingAudios.length > 0 && !isAudioPlaying) {
                playNextAudio();
            }
        };

        // 添加用户交互事件监听
        const events = ['click', 'touchstart', 'keydown'];
        events.forEach(event => {
            document.addEventListener(event, markUserInteraction, { once: true });
        });

        return () => {
            events.forEach(event => {
                document.removeEventListener(event, markUserInteraction);
            });
        };
    }, []);

    // 创建公共的API请求参数构建函数
    const buildRequestParams = (text: string, voice?: string) => {
        const params: any = {
            text: text,
            history: formatMessagesForAPI(messages),
            systemPrompt: systemPrompt,
            model: selectedModel,
            enableVoiceResponse: enableVoiceResponse
        };

        // 如果启用了语音回复并选择了音色，添加音色参数
        if (enableVoiceResponse && voice) {
            params.voice = voice;
            console.log('使用音色:', voice);
        }

        return params;
    };

    // 创建公共的FormData构建函数
    const buildFormData = (audioBlob: Blob) => {
        const formData = new FormData();
        formData.append('audio', audioBlob);
        formData.append('history', JSON.stringify(formatMessagesForAPI(messages)));
        formData.append('systemPrompt', systemPrompt);
        formData.append('model', selectedModel);
        formData.append('enableVoiceResponse', enableVoiceResponse.toString());

        // 添加音色参数
        if (selectedVoice) {
            formData.append('voice', selectedVoice);
            console.log('发送音色参数:', selectedVoice);
        }

        return formData;
    };

    // 通用的SSE数据处理函数
    const processSSEData = (
        data: any,
        updateUserMessage: boolean,
        hasUpdatedUserMessage: boolean,
        hasAddedAssistantMessage: boolean,
        currentMessage: string
    ): {
        hasUpdatedUserMessage: boolean,
        hasAddedAssistantMessage: boolean,
        currentMessage: string
    } => {
        let updatedUserMsg = hasUpdatedUserMessage;
        let addedAssistantMsg = hasAddedAssistantMessage;
        let updatedCurrentMsg = currentMessage;

        console.log('收到SSE数据:', data);

        if (data.type === 'recognition' && updateUserMessage) {
            console.log('收到用户语音识别结果:', data.content);
            // 更新用户消息
            setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1].content = data.content;
                return newMessages;
            });
            updatedUserMsg = true;
        } else if (data.type === 'text') {
            if (!addedAssistantMsg) {
                // 第一次收到文本回复时，添加助手消息
                setMessages(prev => [...prev, {
                    type: 'assistant',
                    content: data.content || '',
                    timestamp: new Date()
                }]);
                addedAssistantMsg = true;
                updatedCurrentMsg = data.content || '';
            } else {
                // 将新内容追加到现有的助手消息中
                updatedCurrentMsg += data.content || '';
                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1].content = updatedCurrentMsg;
                    return newMessages;
                });
            }
        } else if (data.type === 'audio') {
            // 处理音频回复
            playAudioResponse(data.content);
        }

        return {
            hasUpdatedUserMessage: updatedUserMsg,
            hasAddedAssistantMessage: addedAssistantMsg,
            currentMessage: updatedCurrentMsg
        };
    };

    // 使用上面的公共函数，优化handleStreamResponse
    const handleStreamResponse = async (url: string, body: any) => {
        try {
            setIsLoading(true);
            // 标记这是文本输入而非语音输入
            const isTextInput = url.includes('/api/chat/stream');

            const response = await fetch(`${getApiBaseUrl()}${url}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream',
                },
                body: JSON.stringify({
                    ...body,
                    systemPrompt: systemPrompt,
                    model: selectedModel // 添加模型选择
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let currentMessage = '';
            let hasUpdatedUserMessage = isTextInput; // 如果是文本输入，则已经更新了用户消息
            let hasAddedAssistantMessage = false;
            let buffer = ''; // 用于存储不完整的数据

            if (!reader) {
                throw new Error('无法读取响应流');
            }

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // 保留最后一个不完整的行
                console.log('处理SSE行数:', lines.length);

                for (const line of lines) {
                    if (line.trim() === '') continue;

                    // 检查是否包含event字段
                    if (line.includes('"event":')) {
                        try {
                            // 解析完整的SSE事件
                            const eventData = JSON.parse(line);
                            console.log('SSE事件数据:', eventData);

                            if (eventData.event === 'message') {
                                const data = JSON.parse(eventData.data);
                                const result = processSSEData(
                                    data,
                                    !isTextInput,
                                    hasUpdatedUserMessage,
                                    hasAddedAssistantMessage,
                                    currentMessage
                                );

                                hasUpdatedUserMessage = result.hasUpdatedUserMessage;
                                hasAddedAssistantMessage = result.hasAddedAssistantMessage;
                                currentMessage = result.currentMessage;
                            } else if (eventData.event === 'error') {
                                const errorData = JSON.parse(eventData.data);
                                console.error('SSE错误:', errorData.error);
                                // 显示错误消息
                                setMessages(prev => [...prev, {
                                    type: 'assistant',
                                    content: `发生错误: ${errorData.error}`,
                                    timestamp: new Date()
                                }]);
                            }
                        } catch (e) {
                            console.error('解析SSE事件失败:', e, line);
                        }
                    } else if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            const result = processSSEData(
                                data,
                                !isTextInput,
                                hasUpdatedUserMessage,
                                hasAddedAssistantMessage,
                                currentMessage
                            );

                            hasUpdatedUserMessage = result.hasUpdatedUserMessage;
                            hasAddedAssistantMessage = result.hasAddedAssistantMessage;
                            currentMessage = result.currentMessage;
                        } catch (e) {
                            console.error('解析SSE数据失败:', e, line);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error in stream response:', error);
            setMessages(prev => [...prev, {
                type: 'assistant',
                content: '抱歉，处理消息时出现错误。',
                timestamp: new Date()
            }]);
        } finally {
            setIsLoading(false);
            // 在模型回答完成后，自动聚焦到输入框
            focusInput();
        }
    };

    // 使用构建的请求参数对象来简化表单提交
    const handleTextSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim()) return;

        try {
            setIsLoading(true);

            // 添加用户消息到历史
            setMessages(prev => [...prev, {
                type: 'user',
                content: inputText,
                timestamp: new Date()
            }]);

            // 清空输入框
            setInputText('');

            // 使用buildRequestParams构建请求体
            const requestParams = buildRequestParams(inputText, selectedVoice);

            await handleStreamResponse('/api/chat/stream', requestParams);
            scrollToBottom();
        } catch (error) {
            console.error('Error sending text to server:', error);
        }
    };

    // 优化发送音频的函数
    const sendAudioToServer = async (audioBlob: Blob) => {
        try {
            setIsLoading(true);

            // 使用公共函数构建formData
            const formData = buildFormData(audioBlob);

            setMessages(prev => [...prev, {
                type: 'user',
                content: '正在处理语音输入...',
                timestamp: new Date()
            }]);

            const response = await fetch(`${getApiBaseUrl()}/api/chat/audio/stream`, {
                method: 'POST',
                // 注意：不要手动设置Content-Type，让浏览器自动设置正确的multipart/form-data和boundary
                headers: {
                    'Accept': 'text/event-stream',
                },
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let currentMessage = '';
            let hasUpdatedUserMessage = false;
            let hasAddedAssistantMessage = false;
            let buffer = ''; // 用于存储不完整的数据

            if (!reader) {
                throw new Error('无法读取响应流');
            }

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // 保留最后一个不完整的行

                for (const line of lines) {
                    if (line.trim() === '') continue;
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            console.log('收到SSE数据:', data); // 调试日志

                            if (data.type === 'text') {
                                // 检查是否包含角色信息
                                if (data.role === 'user') {
                                    console.log('收到用户语音识别结果:', data.content);
                                    // 更新用户消息
                                    setMessages(prev => {
                                        const newMessages = [...prev];
                                        newMessages[newMessages.length - 1].content = data.content;
                                        return newMessages;
                                    });
                                    hasUpdatedUserMessage = true;
                                    // 添加助手消息框
                                    setMessages(prev => [...prev, {
                                        type: 'assistant',
                                        content: '',
                                        timestamp: new Date()
                                    }]);
                                    hasAddedAssistantMessage = true;
                                } else {
                                // 处理助手消息
                                    if (!hasUpdatedUserMessage) {
                                        // 如果尚未收到用户输入的识别结果，我们不做任何修改
                                        // 注释掉下面的代码，不再将用户消息修改为"语音输入已处理"
                                        /*
                                        setMessages(prev => {
                                            const newMessages = [...prev];
                                            newMessages[newMessages.length - 1].content = "语音输入已处理";
                                            return newMessages;
                                        });
                                        */
                                        
                                        // 我们只将标记设置为true，这样下面的代码可以继续添加助手消息
                                        hasUpdatedUserMessage = true;
                                        
                                        console.log('添加助手消息框（无用户输入更新）');
                                        // 添加助手消息框（不管用户消息是否已更新）
                                        setMessages(prev => [...prev, {
                                            type: 'assistant',
                                            content: '',
                                            timestamp: new Date()
                                        }]);
                                        hasAddedAssistantMessage = true;
                                    }

                                    // 更新助手消息内容
                                    currentMessage += data.content;
                                    setMessages(prev => {
                                        const newMessages = [...prev];
                                        newMessages[newMessages.length - 1].content = currentMessage;
                                        return newMessages;
                                    });
                                }
                                scrollToBottom();
                            } else if (data.type === 'recognition') {
                                // 处理语音识别结果
                                console.log('收到语音识别结果:', data.content);
                                // 更新用户消息
                                setMessages(prev => {
                                    const newMessages = [...prev];
                                    newMessages[newMessages.length - 1].content = data.content;
                                    return newMessages;
                                });
                                hasUpdatedUserMessage = true;

                                // 在recognition处理后，添加一个空的助手消息框，为后续的AI回复做准备
                                setMessages(prev => [...prev, {
                                    type: 'assistant',
                                    content: '',
                                    timestamp: new Date()
                                }]);
                                hasAddedAssistantMessage = true;

                                scrollToBottom();
                            } else if (data.type === 'audio') {
                                console.log('收到音频数据，长度:', data.content.length);
                                await playAudioResponse(data.content);
                            }
                        } catch (error) {
                            console.error('解析SSE数据时出错:', error, '原始数据:', line);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error sending audio to server:', error);
            setMessages(prev => [...prev, {
                type: 'assistant',
                content: '抱歉，处理语音输入时出现错误。',
                timestamp: new Date()
            }]);
        } finally {
            setIsLoading(false);
            // 在模型回答完成后，自动聚焦到输入框
            focusInput();
        }
    };

    // 从localStorage加载设置
    const loadSettings = () => {
        try {
            const savedSettings = localStorage.getItem('voiceChatSettings');
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                if (settings.enableVoiceResponse !== undefined) {
                    setEnableVoiceResponse(settings.enableVoiceResponse);
                }
                if (settings.selectedVoice !== undefined) {
                    setSelectedVoice(settings.selectedVoice);
                }
                if (settings.selectedModel !== undefined) {
                    setSelectedModel(settings.selectedModel);
                }
            }
        } catch (error) {
            console.error('加载设置失败:', error);
        }
    };

    // 保存设置到localStorage
    const saveSettings = (enableVoice: boolean, voice: string, model: string) => {
        try {
            const settings = {
                enableVoiceResponse: enableVoice,
                selectedVoice: voice,
                selectedModel: model
            };
            localStorage.setItem('voiceChatSettings', JSON.stringify(settings));
        } catch (error) {
            console.error('保存设置失败:', error);
        }
    };

    // 更新语音回复设置
    const toggleVoiceResponse = (enable: boolean) => {
        setEnableVoiceResponse(enable);
        saveSettings(enable, selectedVoice, selectedModel);
    };

    // 更新音色设置
    const changeVoice = (voice: string) => {
        setSelectedVoice(voice);
        saveSettings(enableVoiceResponse, voice, selectedModel);
    };

    // 更新模型选择
    const changeModel = (model: string) => {
        setSelectedModel(model);
        saveSettings(enableVoiceResponse, selectedVoice, model);
    };

    return (
        <div className="flex flex-col h-full w-full">
            {/* HTTPS警告提示 */}
            <HttpsWarning
                visible={httpsWarningVisible}
                onClose={() => setHttpsWarningVisible(false)}
            />

            <div className="flex flex-col lg:flex-row h-screen w-full bg-gray-100 overflow-hidden">
                {/* 对话历史面板 */}
                <div
                    className={`fixed inset-0 z-50 bg-gray-800 bg-opacity-50 transition-opacity duration-300 ${isConversationPanelOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                    onClick={() => setIsConversationPanelOpen(false)}
                >
                    <div
                        className={`absolute left-0 top-0 bottom-0 w-80 bg-white shadow-xl transition-transform duration-300 ${isConversationPanelOpen ? 'translate-x-0' : '-translate-x-full'}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex flex-col h-full">
                            <div className="p-4 border-b flex justify-between items-center">
                                <h2 className="text-xl font-bold">对话历史</h2>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation(); // 防止事件冒泡
                                        setIsConversationPanelOpen(false);
                                    }}
                                    className="p-1 rounded-full hover:bg-gray-200"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            <div className="p-4 border-b">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation(); // 防止事件冒泡
                                        createNewConversation();
                                    }}
                                    className="w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center justify-center"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                    新建对话
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                {conversations.length === 0 ? (
                                    <div className="p-4 text-center text-gray-500">
                                        没有对话历史
                                    </div>
                                ) : (
                                    <ul className="divide-y">
                                        {conversations.map(conversation => (
                                            <li
                                                key={conversation.id}
                                                onClick={(e) => {
                                                    e.stopPropagation(); // 防止事件冒泡
                                                    switchToConversation(conversation.id);
                                                }}
                                                className={`p-3 hover:bg-gray-100 cursor-pointer ${activeConversationId === conversation.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1 pr-2">
                                                        <h3 className="font-medium text-gray-900 truncate">{conversation.title}</h3>
                                                        <p className="text-sm text-gray-500 mt-1">
                                                            {new Date(conversation.updatedAt).toLocaleString()}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={(e) => deleteConversation(conversation.id, e)}
                                                        className="p-1 text-gray-400 hover:text-red-500 rounded"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 聊天窗口 - 改为铺满区域 */}
                <div className="flex-1 flex justify-start items-start px-4 py-4 pb-24 overflow-hidden">
                    <div className="w-full h-full bg-white rounded-lg shadow-md flex flex-col">
                        {/* 标题栏 */}
                        <div className="p-4 border-b flex justify-between items-center">
                            <div className="flex items-center space-x-4">
                                <button
                                    onClick={() => setIsConversationPanelOpen(true)}
                                    className="p-1 rounded-full hover:bg-gray-100"
                                    title="对话历史"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                                    </svg>
                                </button>
                                <h1 className="text-xl sm:text-2xl font-bold">AI 语音助手</h1>
                                <button
                                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                                    className="lg:hidden px-3 py-1 text-gray-600 hover:text-gray-800 focus:outline-none"
                                    aria-label="设置"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* 移动设备HTTPS警告 */}
                        {mobileHttpsWarning && (
                            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4 mx-3 mt-3 rounded-md">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div className="ml-3">
                                        <h3 className="text-sm font-medium text-yellow-800">录音功能受限</h3>
                                        <div className="mt-2 text-sm text-yellow-700">
                                            <p>检测到您正在使用移动设备浏览器，但当前不是HTTPS环境。移动设备浏览器要求必须在HTTPS环境下才能使用录音功能。您可以：</p>
                                            <ul className="list-disc pl-5 mt-1">
                                                <li>通过HTTPS链接访问本应用</li>
                                                <li>使用文本输入方式进行交流</li>
                                                <li>切换到桌面浏览器使用</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 音频播放按钮 (当自动播放被阻止时显示) */}
                        {showPlayButton && pendingAudios.length > 0 && (
                            <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
                                <button
                                    onClick={handleManualPlay}
                                    className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-full shadow-lg transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>点击播放语音</span>
                                </button>
                            </div>
                        )}

                        {/* 消息列表 */}
                        <div
                            ref={chatContainerRef}
                            className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-4"
                        >
                            {messages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center p-4">
                                    <div className="w-16 h-16 mb-4 bg-blue-500 rounded-full flex items-center justify-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-700">开始对话</h3>
                                    <p className="mt-2 text-sm text-gray-500">你可以通过语音或文字与AI助手交流</p>
                                </div>
                            ) : (
                                messages.map((message, index) => (
                                    <div
                                        key={index}
                                        className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`max-w-[85%] sm:max-w-[70%] rounded-lg p-2 sm:p-3 ${message.type === 'user'
                                            ? 'bg-blue-500 text-white markdown-user'
                                            : 'bg-gray-100 text-gray-800 markdown-assistant'
                                            }`}>
                                            <div className="markdown-content">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* 设置面板 - 在大屏幕上靠右显示，在小屏幕上作为抽屉显示 */}
                <div className={`${isSettingsOpen ? 'block' : 'hidden'
                    } lg:block w-full lg:w-80 p-4 bg-white shadow-md fixed lg:static top-0 right-0 h-screen z-50 overflow-y-auto transition-all duration-300`}>
                    <div className="space-y-4 pb-24 lg:pb-0">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold">设置</h2>
                            <button
                                onClick={() => setIsSettingsOpen(false)}
                                className="lg:hidden p-2 text-gray-600 hover:text-gray-800 focus:outline-none"
                                aria-label="关闭设置"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">系统提示词</label>
                            <textarea
                                value={systemPrompt}
                                onChange={(e) => updateSystemPrompt(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                rows={4}
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                通过系统提示词定义AI助手的角色、能力和风格。对当前对话生效。支持Markdown格式。
                            </p>
                        </div>

                        {/* 添加语音回复开关 */}
                        <div className="mt-6">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700">启用语音回复</span>
                                <div className="relative inline-block w-10 align-middle select-none">
                                    <input
                                        type="checkbox"
                                        id="voice-toggle"
                                        checked={enableVoiceResponse}
                                        onChange={(e) => toggleVoiceResponse(e.target.checked)}
                                        className="sr-only"
                                    />
                                    <label
                                        htmlFor="voice-toggle"
                                        className="cursor-pointer"
                                    >
                                        <div className={`block w-10 h-6 rounded-full transition-colors duration-200 ease-in-out ${enableVoiceResponse ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                                        <div className={`absolute left-0.5 top-0.5 bg-white border w-5 h-5 rounded-full transition-transform duration-200 ease-in-out transform ${enableVoiceResponse ? 'translate-x-4 border-blue-500' : 'border-gray-300'}`}></div>
                                    </label>
                                </div>
                            </div>
                            <p className="mt-1 text-xs text-gray-500">
                                {enableVoiceResponse ? '开启后AI助手将通过语音回答你的问题' : '关闭后AI助手将只以文字形式回答'}
                            </p>
                        </div>

                        {/* 添加音色选择下拉菜单 */}
                        {enableVoiceResponse && (
                            <div className="mt-4">
                                <label htmlFor="voice-select" className="block text-sm font-medium text-gray-700 mb-1">
                                    选择音色
                                </label>
                                <select
                                    id="voice-select"
                                    value={selectedVoice}
                                    onChange={(e) => changeVoice(e.target.value)}
                                    className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                >
                                    {voiceOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                <p className="mt-1 text-xs text-gray-500">
                                    选择不同音色将改变AI助手的声音特征
                                </p>
                            </div>
                        )}

                        {/* 添加模型选择下拉菜单 */}
                        <div className="mt-4">
                            <label htmlFor="model-select" className="block text-sm font-medium text-gray-700 mb-1">
                                选择模型
                            </label>
                            <select
                                id="model-select"
                                value={selectedModel}
                                onChange={(e) => changeModel(e.target.value)}
                                className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            >
                                {modelOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            <p className="mt-1 text-xs text-gray-500">
                                选择不同模型将改变AI助手的回答风格
                            </p>
                        </div>

                        <div>
                            <button
                                onClick={clearHistory}
                                className="mt-4 w-full inline-flex justify-center items-center px-4 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                清空当前对话
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* 底部输入区域 - 改为响应式布局 */}
            <div className="fixed bottom-0 left-0 right-0 lg:right-80 bg-white border-t px-4 py-3 sm:py-4 z-10">
                <div className="w-full flex items-center space-x-2 sm:space-x-4">
                    <button
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`flex-none w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center ${
                            isRecording 
                                ? 'bg-red-500 hover:bg-red-600' 
                                : 'bg-blue-500 hover:bg-blue-600'
                            } text-white focus:outline-none transition-colors duration-200`}
                        disabled={isLoading}
                        aria-label={isRecording ? "停止录音" : "开始录音"}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                    </button>

                    <form onSubmit={handleTextSubmit} className="flex-1 flex space-x-2 sm:space-x-4">
                        <input
                            type="text"
                            ref={inputRef}
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="输入消息或 Markdown 格式文本..."
                            className="flex-1 p-2 rounded border focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-800"
                            disabled={isLoading}
                        />
                        <button
                            type="submit"
                            className="px-3 py-2 sm:px-4 text-sm sm:text-base bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none transition-colors duration-200"
                            disabled={isLoading || !inputText.trim()}
                        >
                            发送
                        </button>
                    </form>
                </div>
                {isLoading && (
                    <div className="absolute top-0 left-0 right-0 transform -translate-y-full">
                        <div className="w-full mx-auto">
                            <div className="flex items-center justify-center space-x-2 bg-blue-50 text-blue-700 p-2 rounded-t-lg shadow-md">
                                <div className="animate-pulse w-2 h-2 bg-blue-600 rounded-full"></div>
                                <div className="animate-pulse delay-100 w-2 h-2 bg-blue-600 rounded-full"></div>
                                <div className="animate-pulse delay-200 w-2 h-2 bg-blue-600 rounded-full"></div>
                                <span className="text-sm">AI思考中...</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 音频播放器 */}
            <audio
                ref={audioElementRef}
                className="hidden"
                onEnded={handleAudioEnded}
                onError={(e) => console.error('Audio playback error:', e)}
                controls
            />
        </div>
    );
}
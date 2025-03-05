const fs = require('fs');
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // 忽略特定的HTML属性警告
  // 这可以解决"Extra attributes from the server: inmaintabuse"警告
  compiler: {
    reactRemoveProperties: process.env.NODE_ENV === 'production' ? { properties: ['^data-', '^aria-', '^inmaintabuse'] } : false,
  },

  // HTTPS配置
  // 取消注释并确保证书文件存在即可启用HTTPS
  // 移动设备浏览器要求必须在HTTPS环境下才能使用录音功能

  // 检查自签名证书文件是否存在
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*', // 后端API地址
      },
    ];
  },
}

// 支持本地HTTPS开发环境的简单脚本
// 如果要启用HTTPS，取消下面注释并运行：
// 1. 生成证书: npm run generate-certs (添加到package.json中)
// 2. 启动HTTPS服务器: npm run dev-https (添加到package.json中)

/*
// 尝试加载证书（如果存在）
try {
  const certPath = path.join(process.cwd(), 'certs');
  const keyPath = path.join(certPath, 'localhost-key.pem');
  const certFilePath = path.join(certPath, 'localhost-cert.pem');
  
  if (fs.existsSync(keyPath) && fs.existsSync(certFilePath)) {
    nextConfig.server = {
      https: {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certFilePath)
      }
    }
    console.log('🔒 HTTPS已启用，使用自签名证书');
  }
} catch (error) {
  console.log('ℹ️ HTTPS未启用，使用HTTP模式运行');
  console.log('  如需启用HTTPS，请先生成自签名证书');
}
*/

module.exports = nextConfig 
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## 移动设备浏览器支持

请注意，由于浏览器安全策略，移动设备上的Chrome、Safari等浏览器要求必须在HTTPS环境下才能使用麦克风录音功能。

### 解决方案

1. **使用HTTPS部署**：将应用部署到支持HTTPS的环境中（如Vercel、Netlify等）。

2. **本地开发HTTPS配置**：
   - 在`next.config.js`中配置HTTPS（已提供注释示例）
   - 生成自签名证书：
     ```bash
     openssl req -x509 -newkey rsa:2048 -nodes -sha256 -subj '/CN=localhost' \
     -keyout localhost-key.pem -out localhost-cert.pem
     ```
   - 修改配置文件指向证书路径

3. **在桌面浏览器上使用**：桌面版Chrome/Firefox在HTTP环境下也可以使用麦克风功能。

### 不支持的浏览器症状

如果用户在移动设备上通过HTTP访问，应用会显示警告提示，用户可以选择使用文本输入或切换到支持的环境。

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

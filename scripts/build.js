const fs = require('fs/promises');
const path = require('path');

async function build() {
    const rootDir = path.join(__dirname, '..');
    const srcDir = path.join(rootDir, 'src');
    const distDir = path.join(rootDir, 'dist');

    try {
        // 清理dist目录
        await fs.rm(distDir, { recursive: true, force: true });
        
        // 创建新的dist目录
        await fs.mkdir(distDir);

        // 复制文件
        await fs.copyFile(path.join(srcDir, 'server.js'), path.join(distDir, 'server.js'));
        await fs.copyFile(path.join(srcDir, 'cli.js'), path.join(distDir, 'cli.js'));

        // 设置cli.js为可执行
        await fs.chmod(path.join(distDir, 'cli.js'), '755');

        console.log('Build completed successfully!');
    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

build(); 
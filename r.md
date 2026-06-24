🚀 最新部署方案（包含设置管理员密码）
第一步：正常打包上传
把上面的 functions 和 public 文件夹整体拖拽上传到你的 Cloudflare Pages 控制台进行版本发布（参考前次的上传部署流程）。

第二步：在环境变量中设置管理员密码 (关键)
在 Cloudflare 控制台，进入你刚刚创建部署的 Pages 项目主页。

切换到顶部的 "设置 (Settings)" 选项卡。

在左侧子菜单中选择 "环境变数 (Environment variables)"。

滚动到页面下方，在 “生产环境 (Production)” 下点击 "添加变量 (Add variable)"：

变量名称 (Variable name): ADMIN_PASSWORD

值 (Value): 你自定义的复杂密码 (例如 MySecSign2026)

如果下方有“预览环境 (Preview)”，也建议添加相同的变量名与值。

点击 "保存 (Save)"。

第三步：重新激活让密码生效
切换到项目的 "部署 (Deployments)" 选项卡 ➡️ 点击最新一次上传记录右侧的三个点 ... ➡️ 选择 "重试部署 (Retry deployment)"。

第一步：创建 KV 数据库命名空间
登录 Cloudflare 控制台。

在左侧菜单栏点击 "存储与数据库 (Storage & Databases)" ➡️ "KV"。

点击 "创建命名空间 (Create Namespace)"。

输入名称：PDF_SIGN_KV，点击创建。

第二步：部署到 Cloudflare Pages
在左侧菜单栏点击 "工作人员和页 (Workers & Pages)" ➡️ 点击 "创建 (Create)" ➡️ 选择 "页 (Pages)" 选项卡。

选择 "直接上传 (Direct Upload)"。

输入项目名称（例如 my-pdf-signer），然后点击 "创建项目 (Create project)"。

此时，将你本地电脑里的 pdf-signer 整个文件夹拖拽或上传到网页中。

上传完成后，点击 "部署站点 (Deploy site)"。
-----------------------------------
第三步：绑定 KV 数据库到 Pages 项目
这一步至关重要，否则后端 API 会报错无法运行：

在刚刚创建的 Pages 项目管理后台中，切换到 "设置 (Settings)" 选项卡。

在左侧子菜单点击 "函数 (Functions)"。

向下滚动找到 "KV 命名空间绑定 (KV namespace bindings)"，点击 "添加绑定 (Add binding)"。

变量名称 (Variable name) 必须填写：DB （对应代码里的 env.DB）。

KV 命名空间 (KV namespace) 选择你第一步创建的 PDF_SIGN_KV。

点击 "保存 (Save)"。

第四步：重新部署以使绑定生效
切换到项目的 "部署 (Deployments)" 选项卡。

找到你刚才的首次部署，点击右侧的三个点 ...，选择 "重试部署 (Retry deployment)"（或者重新上传一次文件夹）。

🎉 验证使用
部署成功后，Cloudflare 会为你分配一个 *.pages.dev 的免费二级域名：

访问 https://your-project.pages.dev/admin.html 进入管理后台。

上传一个 PDF 文件，在渲染图上鼠标点击确定签名框位置，点击“保存模板...”。

复制生成的分享链接并在手机上打开，输入姓名并手写签字提交。

回到 admin.html 后台输入对应的模板 ID，点击 “一键合成并打包下载...”，你将直接获得包含所有人已签字合同的 ZIP 压缩包！




🔥 终极形态效果测试
访问 /admin.html，输入你刚才在环境变量配置的密码，点击“记住密码”，上方会瞬间把 KV 数据库里的项目拉取并刷新出来。

上传 PDF 文件，使用鼠标翻页找到你希望盖章的任意页面，随后在画面中通过鼠标左键按住拖拽拉出一个红色的签字虚线框（可大可小、可方可扁），点击发布。

签署人打开手机链接，不管手指画下的字在巨大虚线框中占了多小的地方，系统会自动把字抠出来、剥离所有透明死角、压缩控制在 20KB 以内后上传。

管理员一键打包下载，合成出来的 PDF 中，每个人的签名都会在原先拉取的红框内绝对等比例居中填满，字体丝滑清晰，后台隐私也得到了绝对的安全控制！




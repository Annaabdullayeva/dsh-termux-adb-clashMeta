# dsh-termux-adb-clash

[English](README.md) | 简体中文

这是一个 DeepSeek Harness（DSH）插件，通过 ADB 查询、启动和停止同一台手机上的 Clash Meta for Android。DSH Host 必须运行在 **Android 上的 Termux** 中。此插件不用于桌面端或远程 ADB；即使在其他设备上打开可选的 DSH Web 界面，插件仍然在手机上运行。停止 Clash Meta 可能中断依赖其 VPN 或代理的连接。

## 前置条件

- 使用支持**无线调试**的 Android 手机（Android 11 或更新版本），并在同一台手机上安装 Termux 和 [Clash Meta for Android](https://github.com/MetaCubeX/ClashMetaForAndroid)。先完成 Clash Meta 的初始设置，导入配置，并在 Android 提示时授予 VPN 权限。
- 在 Termux 中运行 DSH。DeepSeek 官方目前未提供 Termux 支持；本项目使用 [termux-dsh-native](https://github.com/mashago/termux-dsh-native) 的社区脚本安装 DSH，并在 `0.2.2-rc.5` 上验证。
- 在 Termux 中安装 Git、原生 Node.js 和 ADB（`android-tools`）：

  ```sh
  pkg install git nodejs android-tools
  ```

## 配对并连接 ADB

1. 将手机连接到可信的 Wi-Fi 网络，打开**开发者选项 → 无线调试**。只与自己管理的设备配对。
2. 进入无线调试页面，点击**使用配对码配对设备**。保持对话框打开，在 Termux 中运行下列命令。将占位符换成对话框显示的 IP 地址和**临时配对端口**，再按提示输入配对码。

   ```sh
   adb pair '<phone-ip>:<pairing-port>'
   ```

3. 返回**无线调试**主页面，使用该页面显示的 **IP 地址和端口**运行 `adb connect`。这是**连接端口**，不是刚才的配对端口。

   ```sh
   adb connect '<phone-ip>:<connect-port>'
   adb devices -l
   ```

   手机对应的条目应显示 `device`。如果重启了无线调试或切换了网络，请查看当前的 IP 和端口并重新连接。只有 Android 不再信任原配对时才需要重新配对。不再使用时请关闭无线调试。

## 安装插件

在手机上将仓库克隆到 Termux 的主目录：

```sh
git clone https://github.com/Annaabdullayeva/dsh-termux-adb-clashMeta.git "$HOME/dsh-termux-adb-clash"
printf '%s\n' "$HOME/dsh-termux-adb-clash"
```

在 DSH 中打开**插件 → 添加插件**，在包名输入框中粘贴上面打印的绝对路径，点击**安装**，并在提示时启用插件包。请粘贴实际路径，不要原样输入 `~` 或 `$HOME`。安装后请保留仓库目录。

若你的 DSH 构建支持在终端管理插件，请先查看 `dsh --help`、`dsh plugin --help` 以及已安装版本的文档。如果文档明确支持通过 `dsh plugin --profile … add` 添加本地 `file:` 依赖，`web` profile 可使用以下等效命令：

```sh
dsh plugin --profile web add "file:$HOME/dsh-termux-adb-clash"
```

打开**设置 → Clash Meta**，即可直接查询状态、启动或停止 Clash Meta，无需使用模型。也可让助手调用 `termux_adb_clash`，可用操作为 `status`（查询）、`on`（启动）和 `off`（停止）。插件无需额外配置，会在需要时启动本地 ADB 服务。如果插件无法连接手机，请在 Termux 中检查 `adb devices -l`，并用当前连接端口重新连接。

## 可选：启动 DSH Web 界面但不自动打开浏览器

[示例启动脚本](examples/dsl)会启动 Termux 本地 ADB 服务和 DSH Web profile，但不会打开浏览器，也不会开启 Android 的无线调试。Web 界面默认监听 `127.0.0.1:3080`，只能在手机本机访问：

```sh
"$HOME/dsh-termux-adb-clash/examples/dsl"
```

如需从可信局域网中的其他设备访问，请显式传入 `--lan`。脚本使用原生 Node.js 读取物理 Wi-Fi 接口 `wlan0` 的 IPv4 地址，不使用 VPN 接口的地址。如果设备使用其他名称符合 `wlan<数字>` 格式的接口，可通过 `--iface` 指定：

```sh
"$HOME/dsh-termux-adb-clash/examples/dsl" --lan
"$HOME/dsh-termux-adb-clash/examples/dsl" --lan --iface wlan1 --port 3080 --wait 45
```

`--wait` 设置等待 Wi-Fi IPv4 地址的时长（默认 45 秒）；到时仍未取得地址则改用回环地址。可用 `--port` 修改 Web 界面端口。局域网访问需要显式开启，使用未加密的 HTTP。请在同一可信局域网内使用浏览器打开脚本输出的网址；在共享或公共网络上请保留仅限本机访问的默认设置，不要把 Web 界面的端口转发到互联网。

### 可选：使用 Termux:Boot 开机启动

从与 Termux 安装兼容的来源安装 [Termux:Boot](https://github.com/termux/termux-boot)，并手动打开一次。若要开机后允许局域网访问，可创建以下小脚本（如果 `dsh-web` 已存在，请改用未使用的文件名）：

```sh
mkdir -p "$HOME/.termux/boot"
(
  set -C
  {
    printf '#!%s/bin/sh\n' "$PREFIX"
    cat <<'EOF'
exec "$HOME/dsh-termux-adb-clash/examples/dsl" --lan
EOF
  } > "$HOME/.termux/boot/dsh-web" &&
    chmod 700 "$HOME/.termux/boot/dsh-web"
)
```

去掉 `--lan` 即可改为仅允许本机访问。此脚本启动 DSH 和 Termux 本地 ADB 服务，但不会开启 Android 无线调试或启动 Clash Meta。若重启后脚本找不到 Wi-Fi 地址，或插件无法连接 Android，请在 Termux 中检查 Wi-Fi 和 ADB 连接。

## 问题反馈与许可证

请在 [GitHub Issues](https://github.com/Annaabdullayeva/dsh-termux-adb-clashMeta/issues) 反馈问题。建议附上 Android、DSH 和 Clash Meta 的版本及相关错误信息，但不要提交配对码或凭据。

[MIT](LICENSE)

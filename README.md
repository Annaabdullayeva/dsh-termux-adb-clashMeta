# dsh-termux-adb-clash

English | [简体中文](README.zh-CN.md)

A DeepSeek Harness (DSH) plugin for checking, starting, and stopping Clash Meta for Android through ADB on the same phone. The DSH Host must run **in Termux on Android**. This is not a desktop or remote-ADB setup; opening the optional DSH Web UI from another device does not change where the plugin runs. Stopping Clash Meta can interrupt connections that depend on its VPN or proxy.

## Prerequisites

- Android with **Wireless debugging** (Android 11 or later) and Termux on the same device as [Clash Meta for Android](https://github.com/MetaCubeX/ClashMetaForAndroid). Install the app and finish its initial setup, including importing a profile and granting Android's VPN permission when prompted.
- DSH running in Termux. DeepSeek does not currently provide official Termux support. This project was tested with DSH `0.2.2-rc.5` installed using the community [termux-dsh-native](https://github.com/mashago/termux-dsh-native) scripts.
- In Termux, install Git, native Node.js, and ADB (`android-tools`):

  ```sh
  pkg install git nodejs android-tools
  ```

## Pair and connect ADB

1. On the phone, enable **Developer options → Wireless debugging** while connected to a trusted Wi-Fi network. Pair only with your own device.
2. In Wireless debugging, tap **Pair device with pairing code**. Keep the dialog open while running the following in Termux. Replace the placeholder with the IP address and **temporary pairing port** shown in that dialog, then enter the displayed pairing code at the prompt.

   ```sh
   adb pair '<phone-ip>:<pairing-port>'
   ```

3. Go back to the main **Wireless debugging** screen. Use the **IP address & port** from that screen in `adb connect`. This is the **connection port**, not the port from the pairing dialog.

   ```sh
   adb connect '<phone-ip>:<connect-port>'
   adb devices -l
   ```

   The phone's entry should show `device`. If Wireless debugging restarts or you change networks, check that screen for the current address and port and reconnect. Pair again only if Android no longer trusts the existing pairing. Turn Wireless debugging off when you no longer need it.

## Install the plugin

Clone the repository on the phone, into Termux's home directory:

```sh
git clone https://github.com/Annaabdullayeva/dsh-termux-adb-clashMeta.git "$HOME/dsh-termux-adb-clash"
printf '%s\n' "$HOME/dsh-termux-adb-clash"
```

In DSH, open **Plugins → Add plugin**. Paste the absolute path printed above into the package field, choose **Install**, and enable the bundle if prompted. Use the actual path, not a literal `~` or `$HOME`. Keep the checkout in place.

If your DSH build exposes plugin management in the shell, check `dsh --help`, `dsh plugin --help`, and your installed version's docs first. On builds that document `dsh plugin --profile … add` with local `file:` dependencies, the equivalent for the `web` profile is:

```sh
dsh plugin --profile web add "file:$HOME/dsh-termux-adb-clash"
```

Open **Settings → Clash Meta** to check the status, start, or stop Clash Meta directly; no model is needed. If you prefer to ask the assistant, it can use `termux_adb_clash` with `status`, `on`, or `off`. The plugin needs no extra configuration and starts the local ADB server as needed. If it cannot reach the phone, check `adb devices -l` in Termux and reconnect using the current connection port.

## Optional: run the DSH Web UI without opening a browser

The [example launcher](examples/dsl) starts the local Termux ADB server and runs the Web profile without opening a browser. It does not turn on Android Wireless debugging. With no arguments the Web UI listens on `127.0.0.1:3080`, so only the phone can reach it:

```sh
"$HOME/dsh-termux-adb-clash/examples/dsl"
```

On a trusted LAN, opt in to access from another device with `--lan`. The launcher uses native Node.js to select the IPv4 address of the physical `wlan0` interface, rather than a VPN interface. If your device uses a different `wlan<number>` interface, pass it with `--iface`:

```sh
"$HOME/dsh-termux-adb-clash/examples/dsl" --lan
"$HOME/dsh-termux-adb-clash/examples/dsl" --lan --iface wlan1 --port 3080 --wait 45
```

`--wait` controls how long to wait for a Wi-Fi IPv4 address (45 seconds by default); if none is available by then, the launcher starts on loopback instead. `--port` changes the Web UI port. LAN access is opt-in and uses plain HTTP. Open the printed URL from a browser on the same trusted LAN, keep the loopback default on shared or public networks, and do not forward the Web UI port to the internet.

### Optional: launch at boot with Termux:Boot

Install [Termux:Boot](https://github.com/termux/termux-boot) from a source compatible with your Termux installation and open it once. For LAN access at boot, create this small wrapper (choose an unused filename if `dsh-web` already exists):

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

Remove `--lan` for loopback-only startup. This wrapper starts DSH and local Termux ADB, not Android Wireless debugging or Clash Meta; after reboot, check Wi-Fi and ADB in Termux if the launcher cannot find the Wi-Fi address or the plugin cannot reach Android.

## Issues and license

Report problems in [GitHub Issues](https://github.com/Annaabdullayeva/dsh-termux-adb-clashMeta/issues). Include Android, DSH, and Clash Meta versions and relevant error messages, but omit pairing codes and credentials.

[MIT](LICENSE)

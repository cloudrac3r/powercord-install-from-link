const {Plugin} = require("powercord/entities")
const webpack = require("powercord/webpack")
const {getModuleByDisplayName, getModule, React} = webpack
const {ContextMenu: {Button}} = require("powercord/components")
const {inject, uninject} = require("powercord/injector")
const pj = require("path").join
const {spawn} = require("child_process")
const fs = require("fs")

function announce(message) {
	powercord.pluginManager.get("pc-announcements").sendNotice({
		id: "install-from-link",
		message,
		alwaysDisplay: true
	})
}

module.exports = class InstallFromLink extends Plugin {
	constructor() {
		super()
	}

	async startPlugin() {
		const MessageContextMenu = await getModuleByDisplayName("MessageContextMenu")

		const _this = this
		inject("install-from-link-messageContext", MessageContextMenu.prototype, "render", function(_, res) {
			console.log(this)
			const {target} = this.props;
			if (target.tagName.toLowerCase() === "a") {
				const href = target.href
				let match = href.match(/^https?:\/\/(www.)?github.com\/[\w-]+\/[\w-]+/)
				if (match) {
					const link = match[0]
					const repoName = link.match(/[\w-]+$/)[0]

					/*
						NativeContextMenu's children is a single object, turn it in to an array to be able to push
						Not using NativeContextMenu here, but whatever.
					*/
					if (typeof res.props.children === 'object' && !(res.props.children instanceof Array)) {
						const children = [];
						children.push(res.props.children);

						res.props.children = children;
					}

					res.props.children.push(
						React.createElement(Button, {
							name: "⚡ Install Plugin",
							seperate: true,
							onClick: () => {
								const pluginsDir = pj(__dirname, "..")
								const c = spawn("git", ["clone", link], {
									cwd: pluginsDir,
									windowsHide: true
								})
								let status = "Hmm, looks like the plugin wasn't installed. You can check the devtools console for more info." // generic failure message
								c.stdout.on("data", data => console.log(data.toString()))
								c.stderr.on("data", data => {
									data = data.toString()
									console.error(data)
									if (data.includes("already exists")) status = "You already have that plugin installed. The existing installation was not affected."
								})
								c.on("exit", code => {
									if (code === 0) {
										try {
											const files = fs.readdirSync(pj(pluginsDir, repoName))
											if (files.includes("manifest.json")) {
												announce("The plugin was installed successfully! Press Ctrl-R to reload Discord to use it.")
											} else {
												announce("That repo is not a Powercord plugin. It's been cloned anyway, but don't expect it to do anything.")
											}
										} catch (e) { // readdirSync failed
											announce(status) // just do this for now I guess
										}
									} else { // non-zero exit code
										announce(status)
									}
								})
							}
						})
					);
				}
			}
			return res;
		})
	}

	pluginWillUnload() {
		uninject("install-from-link-messageContext")
	}
}

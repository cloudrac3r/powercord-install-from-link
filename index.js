const {Plugin} = require("powercord/entities")
const webpack = require("powercord/webpack")
const {getModuleByDisplayName, getModule, React} = webpack
const {ContextMenu: {Button}} = require("powercord/components")
const {inject, uninject} = require("powercord/injector")
const pj = require("path").join
const {spawn} = require("child_process")
const fs = require("fs")

function announce(message, color) {
	powercord.pluginManager.get("pc-notices").sendAnnouncement("install-from-link", {
		message: message,
		color: color
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
			const {target} = this.props;
			if (target.tagName.toLowerCase() === "a") {
				const href = target.href
				let match = href.match(/^https?:\/\/(www.)?(github||gitlab).com\/[\w-]+\/[\w-]+/)
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
								let status
								let c
								try {
									c = spawn("git", ["clone", link], {
										cwd: pluginsDir,
										windowsHide: true
									})
								} catch (e) { // spawn failed
									return announce("Couldn't start the installer. Do you have git installed?", "red")
								}
								c.stdout.on("data", data => console.log(data.toString()))
								c.stderr.on("data", data => {
									data = data.toString()
									console.error(data)
									if (data.includes("already exists")) status = "You already have that plugin installed. The existing installation was not affected."
								})
								c.on("exit", async code => {
									if (code === 0) {
										let files
										try {
											files = fs.readdirSync(pj(pluginsDir, repoName))
										} catch (e) { // readdirSync failed
											return announce(`Cloning apparently succeeded, but the resulting installation folder was nowhere to be found. (Looking for ${pj(pluginsDir, repoName)})`, "yellow") // just do this for now I guess
										}
										if (files.includes("manifest.json")) {
											await powercord.pluginManager.remount(repoName)
											if (powercord.pluginManager.plugins.has(repoName)) {
												announce("The plugin was installed and loaded successfully!", "green")
											} else { // remount mysteriously failed
												announce("The plugin was installed, but you'll need to press Ctrl-R to reload Discord before you can use it.", "green")
											}
										} else { // no manifest
											announce("That repo is not a Powercord plugin. It's been cloned anyway, but don't expect it to do anything.", "orange")
										}
									} else { // non-zero exit code
										if (status) announce(status, "red")
										else announce(`The command mysteriously exited with a non-zero status code (${code}). Do y`, "red")
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

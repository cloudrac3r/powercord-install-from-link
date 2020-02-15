const {Plugin} = require("powercord/entities")
const {getModule, React} = require("powercord/webpack")
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
		const NativeLinkGroup = await getModule(m => m.default && m.default.displayName == "NativeLinkGroup")

		inject("install-from-link-linkGroup", NativeLinkGroup, "default", function(args, res) {
			let match = args[0].href.match(/^https?:\/\/(www.)?git(hub|lab).com\/[\w-]+\/[\w-]+/)
			if (match) {
				const link = match[0]
				const repoName = link.match(/[\w-]+$/)[0]

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
										return announce(`Cloning apparently succeeded, but the resulting installation folder was nowhere to be found. (Looking for ${pj(pluginsDir, repoName)})`, "red") // just do this for now I guess
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
									else announce(`The command mysteriously exited with a non-zero status code (${code}).`, "red")
								}
							})
						}
					})
				);
			}
			return res;
		})
		NativeLinkGroup.default.displayName = "NativeLinkGroup"
	}

	pluginWillUnload() {
		uninject("install-from-link-linkGroup")
	}
}

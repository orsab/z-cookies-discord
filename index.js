require("dotenv").config();
const {
  Client,
  Intents,
  Constants,
  MessageAttachment,
  MessageEmbed,
  MessageButton,
  MessageActionRow,
} = require("discord.js");
const axios = require("axios");
const StellarHandler = require("./stellar");
const fs = require("fs");
const { initDb, getMember, buyPackage, depositBalance, linkMember } =
  require("./db")();
const { Lambda } = require("@aws-sdk/client-lambda");
const UserAgent = require("user-agents");

const stellar = StellarHandler.getInstance();
// stellar.getMuxedAccount('944190830279790662').then(a => console.log(a.accountId()))
const PRICE = Number(process.env.PRICE);

console.log(process.env.DISCORDJS_BOT_TOKEN);

initDb().then((db) => {
  const client = new Client({
    intents: [
      Intents.FLAGS.GUILDS,
      Intents.FLAGS.GUILD_MESSAGES,
      Intents.FLAGS.GUILD_INTEGRATIONS,
    ],
  });

  const getAvailableProxyCountries = async () => {
    const countries = {};
    const res = await axios.get(
      `https://proxy6.net/api/${process.env.PROXY6_TOKEN}/getproxy`
    );
    Object.values(res.data.list)
      .filter((l) => l.active === "1")
      .forEach((p) => {
        countries[p.country] = true;
      });
    return Object.keys(countries);
  };

  client.on("ready", async (param) => {
    const publicKey = stellar.custodian.publicKey();
    stellar.server
      .payments()
      .forAccount(publicKey)
      .cursor("now")
      .stream({
        onmessage: (message) => {
          const { from, to, to_muxed, to_muxed_id, amount } = message;
          console.log({ from, to_muxed, to_muxed_id, amount });

          if (to_muxed_id) {
            getMember(to_muxed_id)
              .then((member) => {
                if (member) {
                  return depositBalance(member.id, amount);
                }
              })
              .catch((e) => {
                linkMember(to_muxed_id, to_muxed).then(() =>
                  depositBalance(to_muxed_id, amount)
                );
              });
          }
        },
      });

    const guild = client.guilds.cache.get(process.env.DISCORDJS_GUILDID);

    const countries = await getAvailableProxyCountries();
    guild.commands.create({
      name: "cookie",
      description:
        "Generate cookie with proxy server, choose available country, sentance to search and go",
      options: [
        {
          name: "tag",
          description:
            "Sentence to search in google, comma separated, default: 'crypto exchange'",
          type: Constants.ApplicationCommandOptionTypes.STRING,
        },
        {
          name: "country",
          description: "Available proxies",
          type: Constants.ApplicationCommandOptionTypes.STRING,
          choices: countries.map((c) => ({ name: c, value: c })),
        },
        {
          name: "count",
          description: "Count of cookie files, default = 1, max = 50",
          type: Constants.ApplicationCommandOptionTypes.NUMBER,
        },
        {
          name: "device",
          description: "Pick device type or stay random",
          type: Constants.ApplicationCommandOptionTypes.STRING,
          choices: ['mobile','tablet','desktop'].map((c) => ({ name: c, value: c })),
        },
        {
          name: "lcount",
          description:
            "Count of internal site links to visit, default = 4, max = 15",
          type: Constants.ApplicationCommandOptionTypes.NUMBER,
        },
        {
          name: "include",
          description: "Force include links, separated with commas",
          type: Constants.ApplicationCommandOptionTypes.STRING,
        },
        {
          name: "proxy",
          description:
            "Use custom proxy, usable format: 'type://user:password@host:port' type - socks5/4,http/s.",
          type: Constants.ApplicationCommandOptionTypes.STRING,
        },
      ],
    });

    guild.commands.create({
      name: "info",
      description: "Get information about the user",
    });

    guild.commands.create({
      name: "deposit",
      description: "Deposit balance",
    });

    console.log(`Bot ready!`);
  });

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName, options, member } = interaction;

    if (commandName === "cookie") {
      const tag = options.data.find((d) => d.name === "tag")?.value;
      const country = options.data.find((d) => d.name === "country")?.value;
      let count = options.data.find((d) => d.name === "count")?.value;
      let lcount = options.data.find((d) => d.name === "lcount")?.value;
      const include = options.data.find((d) => d.name === "include")?.value;
      const exclude = options.data.find((d) => d.name === "exclude")?.value;
      const proxy = options.data.find((d) => d.name === "proxy")?.value;
      const device = options.data.find((d) => d.name === "device")?.value;

      let proxyServer;

      if (proxy) {
        const match =
          /(http|https|socks4|socks5):\/\/([a-zA-Z0-9]*):([a-zA-Z0-9]*)@([0-9.]*):([0-9]*)/g;
        const results = match.exec(proxy);
        if (results.length !== 6) {
          interaction.followUp({
            content: "Bad proxy supplied",
            ephemeral: true,
          });
          return;
        } else {
          proxyServer = {
            proxyHost: `${results[1]}://${results[4]}:${results[5]}`,
            proxyUser: results[2],
            proxyPass: results[3],
          };
        }
      }

      const client = new Lambda({
        region: "us-east-1",
        credentials: {
          accessKeyId: process.env.AWS_USER,
          secretAccessKey: process.env.AWS_PASS,
        },
      });

      if (!lcount) {
        lcount = 1;
      }

      let chunkCount = Math.ceil(lcount / 10);
      const uaoptions = {}
      if(device){
        uaoptions.deviceCategory = device
      }

      const userAgentInstance = new UserAgent(uaoptions);
      const userAgent = userAgentInstance.toString();

      if (!count) {
        count = 1;
      } else if (count > 50) {
        count = 50;
      }

      const id = interaction.member.id;
      const cost = PRICE * count;

      interaction.reply({
        content: `Job started!`,
        ephemeral: true,
      });

      const now = new Date().getTime();

      const getDelta = () => {
        return ((new Date().getTime() - now) / 1000).toFixed(1);
      };

      buyPackage(id, cost)
        .then(() => {
          while (count--) {
            const filename = `/tmp/cookie_${Math.random()}.txt`;
            const promises = [];

            while (chunkCount--) {
              let payload = {
                tag,
                country,
                count: lcount > 10 ? 10 : lcount % 10,
                userAgent,
              };
              if (proxyServer) {
                payload = { ...payload, ...proxyServer };
              }
              if (include) {
                payload.include = include
                  .split(",")
                  .filter((l) => l.includes("."));
              }
              if (exclude) {
                payload.exclude = exclude.split(",");
              }

              console.log(payload);

              promises.push(
                client
                  .invoke({
                    FunctionName: "zorrox-cookies-dev-cookies",
                    InvocationType: "RequestResponse",
                    LogType: "Tail",
                    Payload: JSON.stringify(payload),
                  })
                  .then((res) => {
                    console.log("Done", getDelta(), "sec");
                    const obj = JSON.parse(
                      decodeURIComponent(String.fromCharCode(...res.Payload))
                    );

                    if (!obj.data) {
                      // interaction.followUp({
                      //   content: `Error, empty output. Try again with different options`,
                      //   ephemeral: true,
                      // });
                      return "";
                    }

                    return Buffer.from(obj.data, "base64").toString("utf-8");
                  })
              );
            }

            return Promise.all(promises)
              .then(([...strings]) => {
                let dirtFile = strings.join("\r\n");
                dirtFile = dirtFile.split("\r\n");

                const cleanFile = [];
                cleanFile.push(dirtFile[0]);

                while (dirtFile.length) {
                  const row = dirtFile.pop();
                  for (const _r of dirtFile) {
                    if (!_r.startsWith(row.split("\t").shift())) {
                      cleanFile.push(_r);
                    }
                  }
                }

                return cleanFile.join("\r\n");
              })
              .then((output) => {
                fs.writeFileSync(filename, output);

                interaction.followUp({
                  ephemeral: true,
                  content: "UserAgent: " + userAgent,
                  files: [filename],
                });
              });
          }
        })
        .catch((e) => {
          interaction.followUp({
            content: `Job cannot start: ${e}`,
            ephemeral: true,
          });
        })
        .finally(() => {
          console.log("Done", getDelta(), "sec");
        });
    } else if (commandName === "deposit") {
      const id = interaction.member.id;
      StellarHandler.getInstance()
        .getMuxedAccount(id)
        .then((address) => linkMember(id, address.accountId()))
        .then((member) => {
          interaction.reply({
            content: `Please, send XLM to this address: ${member.address}`,
            ephemeral: true,
          });
        })
        .catch((e) => {
          interaction.reply({
            content: `Error generation of address`,
            ephemeral: true,
          });
        });
    } else if (commandName === "info") {
      const id = interaction.member.id;

      getMember(id).then((info) => {
        if (info) {
          interaction.reply({
            content: `**address**: ${
              info.address
            }\n**balance**: ${info.balance.toFixed(7)}`,
            ephemeral: true,
          });
        } else {
          interaction.reply({
            content: `No user found`,
            ephemeral: true,
          });
        }
      });
    }
  });

  client.on("message", (msg) => {
    console.log(msg.content);
  });

  client.login(process.env.DISCORDJS_BOT_TOKEN);
});

require("dotenv").config();
const { Client, Intents, Constants,MessageAttachment,MessageEmbed } = require("discord.js");
const axios = require("axios");
const fs = require("fs");
const { initDb, getMember, linkMember } = require("./db")();
const { LambdaClient, Lambda } = require("@aws-sdk/client-lambda");
const { Snowflake } = require('nodejs-snowflake');

const uid = new Snowflake();

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
      `https://proxy6.net/api/fa9c175c3c-694ba82d5e-cead8871da/getproxy`
    );
    Object.values(res.data.list)
      .filter((l) => l.active === "1")
      .forEach((p) => {
        countries[p.country] = true;
      });
    return Object.keys(countries);
  };

  client.on("ready", async (param) => {
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
            "Sentence to search in google, default: 'crypto exchange'",
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
          description: "Count found results to use, default = 1",
          type: Constants.ApplicationCommandOptionTypes.NUMBER,
        },
        {
          name: "include",
          description: "Force include links, separated with commas",
          type: Constants.ApplicationCommandOptionTypes.STRING,
        },
        {
          name: "exclude",
          description: "Force exclude into link, separated with commas",
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

    // guild.commands.create({
    //   name: "tip",
    //   description: "Send tip to another participant",
    //   options: [
    //     {
    //       name: "to",
    //       description: "Send to user",
    //       required: true,
    //       type: Constants.ApplicationCommandOptionTypes.USER,
    //     },
    //     {
    //       name: "amount",
    //       description: "Amount to send",
    //       required: true,
    //       type: Constants.ApplicationCommandOptionTypes.INTEGER,
    //       choices: [
    //         { name: "1", value: 1 },
    //         { name: "5", value: 5 },
    //         { name: "10", value: 10 },
    //         { name: "100", value: 100 },
    //       ],
    //     },
    //   ],
    // });

    console.log(`Bot ready!`);
  });

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName, options, member } = interaction;

    if (commandName === "cookie") {
      const tag = options.data.find((d) => d.name === "tag")?.value;
      const country = options.data.find((d) => d.name === "country")?.value;
      const count = options.data.find((d) => d.name === "count")?.value;
      const include = options.data.find((d) => d.name === "include")?.value;
      const exclude = options.data.find((d) => d.name === "exclude")?.value;
      const proxy = options.data.find((d) => d.name === "proxy")?.value;

      let proxyServer;

      if (proxy) {
        const match =
          /(http|https|socks4|socks5):\/\/([a-zA-Z0-9]*):([a-zA-Z0-9]*)@([0-9.]*):([0-9]*)/g;
        const results = match.exec(proxy);
        if (results.length !== 6) {
          interaction.followUp({
              content:"Bad proxy supplied",
              ephemeral:true
          });
          return
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
          secretAccessKey: process.env.AWS_PASS
        },
      });
      let payload = {
        tag,
        country,
        count,
      };
      if (proxyServer) {
        payload = { ...payload, ...proxyServer };
      }
      if(include){
          payload.include = include.split(',')
      }
      if(exclude){
          payload.exclude = exclude.split(',')
      }

      console.log(payload);

      client
        .invoke({
          FunctionName: "zorrox-cookies-dev-cookies",
          InvocationType: "RequestResponse",
          LogType: "Tail",
          Payload: JSON.stringify(payload),
        })
        .then((res) => {
            const obj = JSON.parse(decodeURIComponent(String.fromCharCode(...res.Payload)))
            console.log(obj)
            const filename = `/tmp/cookie_${Math.random()}.txt`
            fs.writeFileSync(filename, Buffer.from(obj.data, 'base64'))

          interaction.followUp({
              ephemeral:true,
              content:'UserAgent: ' + obj.userAgent,
              files:[
                  filename
              ]
          });
        }).catch(e => {
            interaction.followUp({
                content:'Error, Something not went fine...',
                ephemeral:true
            });
        })

      interaction.reply({
          content: `Task created params: `+JSON.stringify({
            tag,
            count,
            country,
            include,
            exclude,
            proxy,
            proxyServer,
          }),
          ephemeral:true
      });
    }
  });

  client.on("message", (msg) => {
    console.log(msg.content);
  });

  client.login(process.env.DISCORDJS_BOT_TOKEN);
});

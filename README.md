# Monster Cookie Generator

*Discord bot for proxied cookie*

### Dependences
- Nodejs 16+
- AWS account for lambda running permissions
- Discord server + bot tokens
- Stellar custodian wallet for XLM payments
- Additional project for AWS serverless puppeteer runner

### Istallation
```bash
$ npm i
$ node index.js
```

### How it works

1. Available commands:
- **/info** - get user balance and address to deposit
- **/deposit** - receive instructions to deposit funds (currently XLM)
- **/cookie** - run proxied cookie generator
2. Type slash command ```/cookie``` with additional options:
- **tag** - search query sentance, comma separated, default = *'crypto exchange'*
- **country** - choose existing proxy from the list, default = without proxy
- **count** - how much cookie files you need
- **lcount** - how much links to visit into the search results
- **include** - include additional sites, comma separated
- **proxy** - Use custom proxy, usable format: *'type://user:password@host:port'*
# notion-api-chore-db-to-gotify
#### (aka notion-gotify)

Node.js program to periodically check the Notion API against a database,
and send a push notification via [Gotify](https://gotify.net/) when conditions are met.

The script specifically targets the ["Home Chores Manager" template by Trishka](https://prototion.com/notion-for/home-chores-manager) but can easily be modified to any Notion db by changing the `getTasksDueTodayOrOverdue` method.

## Installation

### Prerequisites

* [Notion integration](https://www.notion.so/my-integrations) added to your workspace
* Target database shared with integration user
* [Gotify](https://gotify.net/) server installed and configured somewhere
* `node` >=14.15.0 installed

Navigate to the cloned repository and run `yarn` or `npm install`

## Usage

```bash
node . [options]
```
Options:
```bash
    --token=YOUR_NOTION_SECRET # via "my integrations" page on Notion
    --list=true # (optional) grab a list of database IDs using your notion token (no other parameters than --token required to run this)
    --db=YOUR_DB_ID # from the list above
    --gotify-url="https://my.server:port" # gotify server url
    --gotify-token=YOUR_GOTIFY_TOKEN # via apps section of gotify
    --cron-string="0 8-21/3 * * *" # how often to poll Notion and send notifications 
                                   # (the default is every 3rd hour between 8am and 9pm)
    --notion-backlink="https://notion.so/Some-Url" # (optional) backlink to launch when Gotify notification is tapped
    --no-cron=true # (optional) disable the cron scheduler and directly run a one-off poll and push
```
Most options have a `.env` equivalent, see `.env.example`

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License
[MIT](https://choosealicense.com/licenses/mit/)
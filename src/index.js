import cron from "node-cron";
import axios from "axios";
import chalk from "chalk";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { config as dotenv } from "dotenv";
import { Client } from "@notionhq/client";

dotenv();
const argv = yargs(hideBin(process.argv)).argv;

// Parameters, see README, .env.example, or command output
const auth = maybeGetArgs('Notion API token', 'your_token', 'token', 'NOTION_TOKEN');
const list_databases = argv['list'] === "true";
const database_id = maybeGetArgs('Notion Database ID', 'your_db_id', 'db', 'NOTION_DB', !list_databases);
const backlink = maybeGetArgs('Notion Backlink (opened when notification is tapped)', 'your_notion_url', 'notion-backlink', 'NOTION_BACKLINK', false);
const gotify_url = maybeGetArgs('Gotify server URL', 'your_url', 'gotify-url', 'GOTIFY_URL', false);
const gotify_token = maybeGetArgs('Gotify token', 'your_gotify_token', 'gotify-token', 'GOTIFY_TOKEN', gotify_url);
const no_cron = argv['no-cron'] === "true";
const cron_string = argv['cron-string'] || process.env.CRON_STRING || '0 8-21/3 * * *';

// Try and get option from args or .env, and output a help message if not found
function maybeGetArgs(humanName, humanParam, cliParam, envParam, error = true) {
    const arg = argv[cliParam] || process.env[envParam];
    if (!arg) {
        console.log(chalk.redBright.bgBlack.bold(`\n${humanName} not found.\n`));
        console.log('Either pass it as a CLI argument:', chalk.black.bgBlue.bold(` --${cliParam}=${humanParam} `));
        console.log('Or add it to .env as', chalk.black.bgBlue.bold(` ${envParam}=${humanParam} `), '\n');

        if (cliParam === 'db') console.log(chalk.cyanBright.bgBlack.bold("Hint: list known/shared databases with the --list=true option"));
        if (cliParam === 'gotify-url') console.log(chalk.yellow.bgBlack.bold("Continuing without gotify/cron..."));

        if (error) return process.exit(1);
    }
    return arg;
}

console.log(chalk.red.bgBlack("Initialising Notion client..."));
const notion = new Client({ auth });

// Output readable list of (shared with integration) databases to grab ID
const listDatabases = (async () => {
    const databases = await notion.databases.list();
    databases?.results?.map(db => {
        console.log(chalk.whiteBright.bgBlack.bold("\n{"));
        console.log(chalk.whiteBright.bgBlack.bold(`  id: ${db.id}`));
        console.log(chalk.whiteBright.bgBlack.bold(`  title: ${db.title[0].plain_text}`));
        console.log(chalk.whiteBright.bgBlack.bold("}"));
    });
    return databases;
});

// If we're just listing databases, also quit here
if (list_databases) {
    console.log(chalk.blueBright.bgBlack('Listing databases...'));
    await listDatabases();
    process.exit(0);
}
// Below config based on the "Home Chores Manager" template: https://prototion.com/notion-for/home-chores-manager
// But you can configure this for your own DB structure!
const getTasksDueTodayOrOverdue = (async () => {
    const query = await notion.databases.query({ database_id,
        filter: {
            or: [
                {
                    property: "Status",
                    "text": {
                        "contains": "Due today",
                    },
                },
                {
                    property: "Status",
                    "text": {
                        "contains": "overdue",
                    },
                },
        ]},
        sorts: [{
                property: 'Status',
                direction: 'descending',
        }],
    });
    return query?.results?.map((result) => {
        return {
            title: result.properties?.Task?.title[0]?.plain_text,
            status: result.properties?.Status?.formula?.string,
        };
    });
});

// Attempt to send Gotify notification
function sendGotifyMessage(task) {
    if (gotify_url === undefined) return;
    const url = `${gotify_url.replace(/\/$/, "")}/message?token=${gotify_token}`;
    const bullet = task.status.includes('today') ? `👍` : `💀`;
    const bodyFormData = {
        title: `${bullet} ${task.title} (Notion)`,
        message: task.status,
        priority: task.status.includes('today') ? 5 : 6
    };
    // If a backlink was included in the params, attach it to the metadata to be launched when tapped
    if (backlink) {
        bodyFormData.extras = {
            "client::notification": {
                "click": { "url": backlink }
            }
        };
    }
    axios({ method: "post", headers: { "Content-Type": "application/json" }, url, data: bodyFormData })
        .catch((err) => console.log(err.response ? err.response.data : err));
}
// If --no-cron=true or no gotify URL found, just output the tasks to the CLI and quit.
// If --no-cron=true and gotify URL included, this will also send the notifications (useful for testing).
if (no_cron || gotify_url === undefined) {
    const tasks = await getTasksDueTodayOrOverdue();
    console.log('\n');
    tasks.map((task) => {
        const bullet = task.status.includes('today') ? `👍` : `💀`;
        console.log(chalk.white.bgBlack.bold(`${bullet} ${task.title}`));
        sendGotifyMessage(task);
    });
} else {
    console.log(chalk.cyan.bgBlack(`Starting cron schedule with params: ${cron_string}`));
    cron.schedule(cron_string, async () => {
        console.log(chalk.cyan.bgBlack(`Cron task running...`));
        const tasks = await getTasksDueTodayOrOverdue();

        tasks.map((task, index) => {
            console.log(chalk.white.bgBlack(`Sending notification... (${index+1} of ${tasks.length})`));
            sendGotifyMessage(task);
        });
    }, { /** timezone: "Europe/London" **/ }); // defaults to server timezone but can be changed if needed here
}

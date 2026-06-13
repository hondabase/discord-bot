# Hondatabase Discord Bot
This repository hosts the codebase for our own Discord Bot.

It is pretty basic in functionality right now, but it will surely grow with time.

> [!NOTE]
> I'd like you to please feel free to submit any pull requests but make sure to discuss changes on Discord first.

## Files Portal database

Member departure reports can include Files Portal participation when the bot has a read-only MySQL account configured:

```env
# Optional overrides; defaults use MYSQL_USER/MYSQL_PASSWORD and hondabase_files.
FILES_MYSQL_HOST=localhost
FILES_MYSQL_USER=...
FILES_MYSQL_PASSWORD=...
FILES_MYSQL_DATABASE=hondabase_files
```

The account only needs `SELECT` permission on the Files Portal database:

```sql
GRANT SELECT ON hondabase_files.* TO 'bot-user'@'localhost';
```

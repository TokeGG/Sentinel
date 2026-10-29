---
name: table-to-csv
description: Extract a table (prices, schedules, specs, results) from a web page and give it back as CSV text.
category: productivity, dev
---

# Table to CSV

1. Find the table the user means (by its heading or column names). If several match, take the first and name the others.
2. Use the column headers as the CSV header row. If there are none, invent short names (col1, col2, ...) and say so.
3. One CSV row per table row. Quote any cell that contains a comma, quote or line break; double inner quotes.
4. Keep numbers as written (do not convert currencies or units). Leave empty cells empty.
5. If the table is paginated, follow "Next" for at most 5 pages and append rows; say how many pages were read.
6. Answer with the CSV in a code block, then one line: rows, columns, source link.

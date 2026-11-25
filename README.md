Basic semantic search and filtering on sample listings provided
Open questions on requirements:

"A targetBudget value, used along with recency to rank results by relevance — you design the scoring; we're more 
interested in whether your approach is sensible and clearly explained than in one "correct" formula."

Beyond min max price there doesn't seem to be a notion of target budget.

The implementation therefore uses the keyword semantic search as primary sort and uses date listed as a secondary or primary if no keyword is provided.

A sort drop down was added to alleviate confusion and to allow direct control of sorting for the user.

Semantic search was modified to associate "bus" with transit and metro and to filter out negated rows such as "No Pets" or "No Pets Allowed" if the keyword is "Pets".

Produced with CodeX GPT Astra Medium, CHAT.md is provided to view the prompts used.

# Brillio listings

## Run the tests

Run these commands in PowerShell from `C:\Brillio`.

### Python API

```powershell
python -m unittest discover -s .\listings-api -v
```

### React frontend

Install dependencies once with `npm --prefix .\listings-web ci`, then run the pagination tests.

```powershell
npm --prefix .\listings-web test
```

import requests

session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
})

urls = [
    "https://query1.finance.yahoo.com/v7/finance/options/SPY",
    "https://query2.finance.yahoo.com/v7/finance/options/SPY",
    "https://query1.finance.yahoo.com/v6/finance/options/SPY",
    "https://query2.finance.yahoo.com/v6/finance/options/SPY"
]

for url in urls:
    try:
        print(f"Testing url: {url}")
        res = session.get(url)
        print("Status:", res.status_code)
        if res.status_code == 200:
            print("Success! Keys:", res.json().keys())
    except Exception as e:
        print(f"Error on {url}: {e}")

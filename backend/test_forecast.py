import urllib.request, json, datetime

BASE = 'http://localhost:8000'

# 1. Login
data = json.dumps({'username': 'admin', 'password': 'admin123'}).encode()
req = urllib.request.Request(f'{BASE}/api/auth/login', data=data, headers={'Content-Type': 'application/json'})
resp = urllib.request.urlopen(req)
login_data = json.loads(resp.read())
token = login_data.get('token')
print('TOKEN OK:', bool(token))

headers = {'Authorization': f'Bearer {token}'}

# 2. Get active dataset
req2 = urllib.request.Request(f'{BASE}/api/active-dataset', headers=headers)
resp2 = urllib.request.urlopen(req2)
active = json.loads(resp2.read())
print('ACTIVE DS:', active)

# 3. Get all datasets
req3 = urllib.request.Request(f'{BASE}/api/datasets', headers=headers)
resp3 = urllib.request.urlopen(req3)
ds_data = json.loads(resp3.read())
datasets = ds_data.get('datasets', [])
print('DATASETS COUNT:', len(datasets))
for ds in datasets:
    did = ds['id']
    title = ds['title']
    dtype = ds['dataset_type']
    is_active = ds['is_active']
    rows = ds['row_count']
    print(f'  id={did} title={title} type={dtype} active={is_active} rows={rows}')

# 4. If no active dataset, activate the first MASTER dataset
active_id = active.get('active', {})
if active_id:
    active_id = active_id.get('id')

if not active_id:
    master = [d for d in datasets if d.get('dataset_type') in ('MASTER', None)]
    if master:
        activate_req = urllib.request.Request(
            f'{BASE}/api/datasets/{master[0]["id"]}/activate',
            data=b'',
            headers=headers,
            method='POST'
        )
        ar = urllib.request.urlopen(activate_req)
        print('ACTIVATED:', json.loads(ar.read()))
        active_id = master[0]['id']

print('WILL USE DATASET ID:', active_id)

# 5. Get items
req4 = urllib.request.Request(f'{BASE}/api/get-items', headers=headers)
resp4 = urllib.request.urlopen(req4)
items_data = json.loads(resp4.read())
items = items_data.get('items', [])
print('TOTAL ITEMS:', len(items))
print('FIRST 5:', items[:5])

# 6. Try forecast with top-3 items, end_date = 30 days from now
end_date = (datetime.datetime.now() + datetime.timedelta(days=30)).strftime('%Y-%m-%d')
print(f'\nRUNNING FORECAST: top_n=3, end_date={end_date}')
url = f'{BASE}/api/generate-recommendations?end_date={end_date}&mode=top&top_n=3'
try:
    req5 = urllib.request.Request(url, headers=headers)
    resp5 = urllib.request.urlopen(req5, timeout=180)
    result = json.loads(resp5.read())
    print('SUCCESS! chart_data rows:', len(result.get('chart_data', [])))
    print('recommendations keys:', list(result.get('recommendations', {}).keys()))
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print('HTTP ERROR:', e.code, body[:1000])
except Exception as e:
    print('ERROR:', type(e).__name__, str(e)[:500])

# Google spreadsheet와 연동하여 자동화를 실행합니다.
# Sheet URL : https://docs.google.com/spreadsheets/d/1UK_xd4WaxLGxkVfhkzje3pXqFFJELokxGSBGO5Dl2VA/edit?gid=1966824894#gid=1966824894

import gspread

# Google spreadsheet와
gc = gspread.oauth(
    authorized_user_filename='authorized_user.json',
    credentials_filename='client_secret.json'  # Google Cloud OAtuth 2.0 json 파일
)

# 시트 열기 테스트
sh = gc.open("[유저웹] 유저웹 _Smoke CheckList_v1.0")
worksheet = sh.get_worksheet(0) # 첫 번째 시트

# 방법 A: 헤더가 중복되어도 일단 모든 값을 리스트로 가져오기 (가장 안전)
all_values = worksheet.get_all_values()
headers = all_values[0]  # 첫 번째 줄 (헤더)
rows = all_values[1:]    # 두 번째 줄부터 데이터

print(f"헤더: {headers[1]}")
print(f"첫 번째 데이터: {rows[1]}")

# 방법 B: 특정 범위만 지정해서 가져오기 (예: A1부터 E10까지)
# data_range = worksheet.get('A1:E10')
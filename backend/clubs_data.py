"""Lista fixa dos 30 clubes (gerada a partir de shared/clubs.json).

Está em Python, e não em JSON, para ser sempre incluída na função serverless.
Se alterar shared/clubs.json, execute: python scripts/sync_clubs.py
"""

CLUBS = [{'id': 'bayern', 'name': 'Bayern München', 'short': 'FCB', 'colors': ['#DC052D', '#0066B2']},
 {'id': 'arsenal', 'name': 'Arsenal', 'short': 'ARS', 'colors': ['#EF0107', '#FFFFFF']},
 {'id': 'real-madrid', 'name': 'Real Madrid', 'short': 'RMA', 'colors': ['#FFFFFF', '#FEBE10']},
 {'id': 'psg', 'name': 'Paris Saint-Germain', 'short': 'PSG', 'colors': ['#004170', '#DA291C']},
 {'id': 'inter', 'name': 'Internazionale', 'short': 'INT', 'colors': ['#0068A8', '#000000']},
 {'id': 'liverpool', 'name': 'Liverpool', 'short': 'LIV', 'colors': ['#C8102E', '#00B2A9']},
 {'id': 'man-city', 'name': 'Manchester City', 'short': 'MCI', 'colors': ['#6CABDD', '#1C2C5B']},
 {'id': 'barcelona', 'name': 'FC Barcelona', 'short': 'BAR', 'colors': ['#A50044', '#004D98']},
 {'id': 'dortmund', 'name': 'Borussia Dortmund', 'short': 'BVB', 'colors': ['#FDE100', '#000000']},
 {'id': 'roma', 'name': 'AS Roma', 'short': 'ROM', 'colors': ['#8E1F2F', '#F0BC42']},
 {'id': 'leverkusen', 'name': 'Bayer Leverkusen', 'short': 'B04', 'colors': ['#E32221', '#000000']},
 {'id': 'atletico', 'name': 'Atlético Madrid', 'short': 'ATM', 'colors': ['#CB3524', '#272E61']},
 {'id': 'atalanta', 'name': 'Atalanta', 'short': 'ATA', 'colors': ['#1E71B8', '#000000']},
 {'id': 'juventus', 'name': 'Juventus', 'short': 'JUV', 'colors': ['#000000', '#FFFFFF']},
 {'id': 'villarreal', 'name': 'Villarreal', 'short': 'VIL', 'colors': ['#FFE667', '#005187']},
 {'id': 'sporting', 'name': 'Sporting CP', 'short': 'SCP', 'colors': ['#008057', '#FFFFFF']},
 {'id': 'aston-villa', 'name': 'Aston Villa', 'short': 'AVL', 'colors': ['#670E36', '#95BFE5']},
 {'id': 'milan', 'name': 'Milan', 'short': 'MIL', 'colors': ['#FB090B', '#000000']},
 {'id': 'porto', 'name': 'FC Porto', 'short': 'FCP', 'colors': ['#00428C', '#FFFFFF']},
 {'id': 'west-ham', 'name': 'West Ham United', 'short': 'WHU', 'colors': ['#7A263A', '#1BB1E7']},
 {'id': 'benfica', 'name': 'Benfica', 'short': 'SLB', 'colors': ['#E83030', '#FFFFFF']},
 {'id': 'man-united', 'name': 'Manchester United', 'short': 'MUN', 'colors': ['#DA291C', '#FBE122']},
 {'id': 'club-brugge', 'name': 'Club Brugge', 'short': 'CLB', 'colors': ['#0067CE', '#000000']},
 {'id': 'betis', 'name': 'Real Betis', 'short': 'BET', 'colors': ['#0BB363', '#FFFFFF']},
 {'id': 'feyenoord', 'name': 'Feyenoord', 'short': 'FEY', 'colors': ['#E30613', '#FFFFFF']},
 {'id': 'psv', 'name': 'PSV Eindhoven', 'short': 'PSV', 'colors': ['#ED1C24', '#FFFFFF']},
 {'id': 'real-sociedad', 'name': 'Real Sociedad', 'short': 'RSO', 'colors': ['#0067B1', '#FFFFFF']},
 {'id': 'napoli', 'name': 'Napoli', 'short': 'NAP', 'colors': ['#12A0D7', '#003C82']},
 {'id': 'lazio', 'name': 'Lazio', 'short': 'LAZ', 'colors': ['#87D8F7', '#FFFFFF']},
 {'id': 'lille', 'name': 'Lille', 'short': 'LIL', 'colors': ['#E01E13', '#20325F']}]

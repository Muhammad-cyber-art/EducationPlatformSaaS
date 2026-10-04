import calendar
from datetime import date, timedelta

# Hafta kunlari nomlari (Uzbek) va Python weekday() indekslari
# Python: 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday
WEEKDAY_NAMES_UZ = {
    0: "Dushanba",
    1: "Seshanba",
    2: "Chorshanba",
    3: "Payshanba",
    4: "Juma",
    5: "Shanba",
    6: "Yakshanba",
}

# Orqaga muvofiqliq: Eski 'odd'/'even'/'everyday' → yangi weekday indekslari ro'yxati
LEGACY_DAYS_MAP = {
    "odd": [0, 2, 4],        # Du, Chor, Ju
    "even": [1, 3, 5],       # Se, Pay, Shan
    "everyday": [0, 1, 2, 3, 4, 5],  # Du-Shan
}


def normalize_custom_days(days_value):
    """
    Group.custom_days fieldini normallashtiradi va weekday indekslari ro'yxatini qaytaradi.
    
    Input formats:
      - list[int]: [0, 2, 4] (yangi format) → to'g'ridan-to'g'ri qaytariladi
      - str 'odd'/'even'/'everyday': eski format → legacy map orqali o'giriladi
      - None / [] / boshqa: default [0, 2, 4] (odd)
    
    Returns: list[int] of valid weekday indices (0-6)
    """
    if isinstance(days_value, list):
        # JSON array: faqat 0-6 orasidagi butun sonlarni olib qolamiz
        valid = [int(d) for d in days_value if isinstance(d, (int, str)) and int(d) in range(7)]
        return valid if valid else [0, 2, 4]
    
    if isinstance(days_value, str):
        # Eski format
        if days_value in LEGACY_DAYS_MAP:
            return LEGACY_DAYS_MAP[days_value]
        # JSON string bo'lishi mumkin: "[0,2,4]"
        try:
            import json
            parsed = json.loads(days_value)
            if isinstance(parsed, list):
                return normalize_custom_days(parsed)
        except Exception:
            pass
    
    return [0, 2, 4]  # Default: toq kunlar


def get_lessons_in_month(days_value, year, month):
    """
    Guruhning dars kunlari qiymatiga qarab, berilgan oydagi dars sanalarini qaytaradi.
    
    days_value: list[int] yoki str ('odd'/'even'/'everyday') — Group.custom_days yoki Group.days
    """
    weekdays = normalize_custom_days(days_value)
    lessons = []
    num_days = calendar.monthrange(year, month)[1]

    for day in range(1, num_days + 1):
        d = date(year, month, day)
        if d.weekday() in weekdays:
            lessons.append(d)

    return lessons


def is_lesson_day(days_value, date_obj):
    """
    Berilgan sana guruh uchun dars kuni ekanligini aniqlaydi.
    days_value: list[int] yoki str
    """
    weekdays = normalize_custom_days(days_value)
    return date_obj.weekday() in weekdays


def get_days_display_uz(days_value):
    """
    Dars kunlari ro'yxatini o'zbek tilida qisqacha ko'rsatadi.
    Masalan: [0, 2, 4] → "Du, Chor, Ju"
    """
    weekdays = normalize_custom_days(days_value)
    short_names = {
        0: "Du", 1: "Se", 2: "Chor", 3: "Pay", 4: "Ju", 5: "Shan", 6: "Yak"
    }
    return ", ".join(short_names.get(d, str(d)) for d in sorted(weekdays))


def get_days_display_full_uz(days_value):
    """
    Dars kunlari ro'yxatini o'zbek tilida to'liq ko'rsatadi.
    Masalan: [0, 2, 4] → "Dushanba, Chorshanba, Juma"
    """
    weekdays = normalize_custom_days(days_value)
    return ", ".join(WEEKDAY_NAMES_UZ.get(d, str(d)) for d in sorted(weekdays))

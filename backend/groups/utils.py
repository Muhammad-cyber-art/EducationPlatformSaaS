import calendar
from datetime import date, timedelta

def get_lessons_in_month(days_type, year, month):
    """
    Guruhning dars kunlari turiga qarab, berilgan oydagi dars kunlarini aniqlaydi.
    days_type: 'odd', 'even', 'everyday'
    """
    lessons = []
    num_days = calendar.monthrange(year, month)[1]
    
    for day in range(1, num_days + 1):
        d = date(year, month, day)
        if is_lesson_day(days_type, d):
            lessons.append(d)
                
    return lessons

def is_lesson_day(days_type, date_obj):
    """
    Berilgan sana guruh uchun dars kuni ekanligini aniqlaydi.
    """
    if not days_type:
        days_type = 'odd' # Default value if empty
        
    weekday = date_obj.weekday()
    
    if weekday == 6: # Yakshanba doim dam olish kuni
        return False
        
    if days_type == 'everyday':
        return True
    elif days_type == 'odd':
        return weekday in [0, 2, 4] # Du-Chor-Ju
    elif days_type == 'even':
        return weekday in [1, 3, 5] # Se-Pay-Shan
        
    return False

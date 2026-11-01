# Діаграма Ганта Cinema Booking System (за plan.md)

Шкала в робочих днях проєкту (1, 2, 3 ...), вихідні не показано. Один робочий день = 4 год людського часу, півдня = 2 год. Gate-точки виділено світлішим кольором, етапи критичного шляху червоним (Gate на критичному шляху мають червону рамку).

```mermaid
gantt
    title Cinema Booking System, план v2 (робочі дні)
    dateFormat YYYY-MM-DD HH:mm
    axisFormat %e
    tickInterval 1day
    todayMarker off

    section Підготовка
    E0 Специфікація, Gate T-02          :crit, active, e0, 2026-01-01 00:00, 12h
    E1 Тестова інфраструктура           :crit, e1, after e0, 12h

    section Реалізація
    E2 Перегляд, автентифікація, RBAC   :crit, e2, after e1, 36h
    E3 Ядро бронювання                  :e3, after e1, 36h
    E4 Gate T-36                        :crit, active, e4, after e2 e3, 12h
    R4 Резерв на REVISE T-36            :crit, r4, after e4, 12h
    E5 Скасування бронювань             :e5, after r4, 36h
    E6 Адміністрування                  :crit, e6, after r4, 36h
    E7 Gate T-57                        :crit, active, e7, after e5 e6, 12h

    section Завершення
    E8 Журналювання, персистентність    :crit, e8, after e7, 24h
    E9 Верифікація, документація        :crit, e9, after e8, 36h
    E10 Приймання (Validation)          :e10, after e7, 60h
    E11 Gate T-79                       :crit, active, e11, after e9 e10, 12h
    Реліз версії 1                      :milestone, rel, after e11, 0h
```

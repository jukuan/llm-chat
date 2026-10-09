// Map of {category -> label, icon, hint} that drives the form view.
// Filenames on disk are "{key}.md" — no numeric prefixes.
// Add a section here and it appears in the UI.

export const SECTIONS = [
    {
        key: 'address',
        icon: '📍',
        en: 'Address & location',
        be: 'Адрас і размяшчэнне',
        hint: {
            en: 'Street, city, apartment, landmarks, where the key is hidden.',
            be: 'Вуліца, горад, кватэра, арыенціры, дзе схаваны ключ.',
        },
    },
    {
        key: 'wifi',
        icon: '📶',
        en: 'WiFi & internet',
        be: 'Wi-Fi і інтэрнэт',
        hint: {
            en: 'Network name, password, router location, how to reboot.',
            be: 'Назва сеткі, пароль, дзе роўтар, як перазагрузіць.',
        },
    },
    {
        key: 'utilities',
        icon: '⚡',
        en: 'Utilities — power, water, gas',
        be: 'Камуналка — святло, вада, газ',
        hint: {
            en: 'Fuse box, water shutoff, gas shutoff, boiler settings.',
            be: 'Шчыток, перакрыццё вады, газа, налады катла.',
        },
    },
    {
        key: 'appliances',
        icon: '🧺',
        en: 'Appliances',
        be: 'Тэхніка',
        hint: {
            en: 'Washer, dishwasher, oven, vacuum — how to use them.',
            be: 'Пралка, пасудамыйка, печ, пыласос — як карыстацца.',
        },
    },
    {
        key: 'rules',
        icon: '📜',
        en: 'House rules & schedules',
        be: 'Правілы і расклад',
        hint: {
            en: 'Quiet hours, chores, recycling day, screen time.',
            be: 'Цішыня, хатнія справы, дзень смецця, час на экране.',
        },
    },
    {
        key: 'emergency',
        icon: '🚨',
        en: 'Emergency contacts',
        be: 'Экстраныя кантакты',
        hint: {
            en: 'Family, doctor, plumber, electrician, nearest hospital.',
            be: 'Сям\'я, доктар, сантэхнік, электрык, бальніца.',
        },
    },
    {
        key: 'misc',
        icon: '🗒',
        en: 'Anything else',
        be: 'Рознае',
        hint: {
            en: 'Tools, first-aid kit, pets, subscriptions, birthdays.',
            be: 'Інструменты, аптэчка, хатнія жывёлы, падпіскі, дні нараджэння.',
        },
    },
    {
        key: 'learned',
        icon: '📌',
        en: 'Saved answers',
        be: 'Захаваныя адказы',
        hint: {
            en: 'Facts you saved from chat. Review weekly and merge into the right section.',
            be: 'Факты, захаваныя з чату. Пераглядай штотыдзень і перанось у патрэбны раздзел.',
        },
    },
];
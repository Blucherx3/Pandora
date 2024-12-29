import { Client, Role, TextChannel, Message, Collection, EmbedBuilder, DMChannel, NewsChannel, AttachmentBuilder, GuildMember, PermissionsBitField, ChannelType } from 'discord.js';
import type { Channel, PartialGuildMember, GuildBasedChannel } from 'discord.js';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import cron from 'node-cron';
import parser from 'cron-parser';
import { pathToFileURL } from 'url';

/////////////////////////////////////// { Функция для подгрузки в бота старых Артов OneTimeSaver } ////////////////////////////////////////
export async function OneTimeSaver(message: Message, channelIds: string[], direkt: string) {
    const SAVE_DIR = path.join(__dirname, direkt); // Directory to save media files

    if (!fs.existsSync(SAVE_DIR)) {
        fs.mkdirSync(SAVE_DIR);
    }

    const member = message.member as GuildMember;
    if (!(member ? member.permissions.has(PermissionsBitField.Flags.Administrator) : false)) {
        return sendMessageAfterDelet(message.channel, 'У вас недостаточно прав для выполнения этой команды.', 1);
    }

    if (message.content.startsWith('}fetchMedia')) {
        const args = message.content.split('_').slice(1);
        if (args.length !== 2) {
            return sendMessageAfterDelet(message.channel, 'Используй формат: }fetchMedia_<start date>_<end date>', 1);
        }

        const [startDateStr, endDateStr] = args;
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);

        // Проверка дат
        console.log('Start date:', startDate);
        console.log('End date:', endDate);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return sendMessageAfterDelet(message.channel, 'Говно формат. Переделывай YYYY-MM-DD HH:MM', 1);
        }

        const mediaUrls: string[] = [];

        for (const channelId of channelIds) {
            const channel = message.guild?.channels.cache.get(channelId);
            if (channel && channel.type === ChannelType.GuildText) {
                const textChannel = channel as TextChannel;
                try {
                    const messages = await textChannel.messages.fetch({ limit: 100 });
                    console.log(`Fetched ${messages.size} messages from channel ${channelId}`);

                    messages.forEach((msg: Message) => {
                        console.log(`Message created at: ${msg.createdAt}`);
                        if (msg.createdAt >= startDate && msg.createdAt <= endDate) {
                            console.log(`Message within date range: ${msg.createdAt}`);
                            msg.attachments.forEach((attachment) => {
                                if (attachment.contentType?.startsWith('image/') || attachment.contentType?.startsWith('video/')) {
                                    console.log(`Media found: ${attachment.url}`);
                                    mediaUrls.push(attachment.url);
                                }
                            });
                        }
                    });
                } catch (error) {
                    console.error(`Ошибка при получении сообщений из канала ${channelId}:`, error);
                    return sendMessageAfterDelet(message.channel, 'Произошла ошибка при попытке получить сообщения из канала.', 1);
                }
            }
        }

        if (mediaUrls.length === 0) {
            return sendMessageAfterDelet(message.channel, 'За это время ничего не найдено', 1);
        }

        for (const url of mediaUrls) {
            try {
                const fileName = path.basename(url.split('?')[0]);
                const response = await fetch(url);
                const fileStream = fs.createWriteStream(path.join(SAVE_DIR, fileName));
                response.body.pipe(fileStream);
                console.log(`Файл сохранен: ${fileName}`);
            } catch (error) {
                console.error(`Ошибка при скачивании файла ${url}:`, error);
                return sendMessageAfterDelet(message.channel, `Не удалось скачать файл ${url}.`, 1);
            }1_000
        }

        sendMessageAfterDelet(message.channel, `Сохранено ${mediaUrls.length} медиа файлов в директорию ${SAVE_DIR}.`, 1);
    }
}


////////////////////////////////////////// { Функция обработки новых пользователей } /////////////////////////////////////////////////////
export async function addRoleToMember(member: GuildMember, roleId: string, channelId: string): Promise<void> {
    try {
        const role: Role | undefined = member.guild.roles.cache.get(roleId);
        if (role) {
            await member.roles.add(role);
            console.log(`${member.user.tag} теперь имеет роль '${role.name}'`);

            // Получаем канал по ID
            const channel = member.guild.channels.cache.get(channelId) as TextChannel;
            if (channel) {
                // Формируем сообщение с информацией об участнике
                const userInfo = {
                    content: `Новый участник: @${member.user.tag}`,
                    embeds: [{
                        title: "Информация о пользователе",
                        thumbnail: {
                                url: member.user.displayAvatarURL() // Аватар пользователя
                        },
                        fields: [
                            { name: "Имя пользователя", value: member.user.username, inline: true },
                            { name: "Тег", value: `#${member.user.discriminator}`, inline: true },
                            { name: "ID пользователя", value: member.user.id, inline: true },
                        ],
                        color: 0x9834db // фиолетовый цвет для сообщения
                    }]
                };
                
                // Отправляем сообщение в канал
                await channel.send(userInfo);
                console.log(`${member.user.tag} зашёл на сервер.`);
            } else {
                console.log('Канал для отправки сообщения не найден.');
            }
        } else {
            console.log('Роль не найдена.');
        }
    } catch (error) {   
        console.error('Ошибка при добавлении роли и отправке сообщения:', error);
    }
}


////////////////////////////////////////// {Функция оповешения при ливнувшем пользователе } /////////////////////////////////
export async function LeaveMember_ServerMessage(member: GuildMember | PartialGuildMember, channelId: string): Promise<void> {
    try {
            const channel = member.guild.channels.cache.get(channelId) as TextChannel;
            if (channel) {
                const userInfo = {
                    content: `Участник ливнул: @${member.user.tag}`,
                    embeds: [{
                        title: "Информация о пользователе",
                        thumbnail: {
                                url: member.user.displayAvatarURL()
                        },
                        fields: [
                            { name: "Имя пользователя", value: member.user.username, inline: true },
                            { name: "Тег", value: `#${member.user.discriminator}`, inline: true },
                            { name: "ID пользователя", value: member.user.id, inline: true },
                        ],
                        color: 0xc33740
                    }]
                };
                await channel.send(userInfo);
                console.log(`${member.user.tag} покинул сервер.`);
            } else {
                console.log('Канал для отправки сообщения не найден.');
            }
    } catch (error) {   
        console.error('Ошибка при обработке пользователя покинувшего сервер:', error);
    }
}


//////////////////////////////////////////////////// { Функция отправки сообшений админам/модерам sendFile } ////////////////////////////////////////// 
export async function sendFile(message: Message, client: Client, fileName: string) {
    const member = message.guild?.members.cache.get(message.author.id);

    if (member && (member ? member.permissions.has(PermissionsBitField.Flags.Administrator) : false)) {
        const filePath = path.join(__dirname, '..', fileName);
        if (fs.existsSync(filePath)) {
            const file = new AttachmentBuilder(filePath);

            if (message.channel instanceof TextChannel || message.channel instanceof DMChannel || message.channel instanceof NewsChannel) {
                await message.author.send({ files: [file] });
                const botReply = await message.channel.send(`Файл ${fileName} отправлен в личные сообщения.`);
                setTimeout(async () => {
                    await botReply.delete();
                }, 10_000);
            } else {
                console.error('Этот тип канала не поддерживает отправку сообщений.');
            }
        } else {
            if (message.channel instanceof TextChannel || message.channel instanceof DMChannel || message.channel instanceof NewsChannel) {
                const botReply = await message.channel.send(`Файл ${fileName} не найден.`);
                setTimeout(async () => {
                    await botReply.delete();
                }, 60_000);
            }
        }
    } else {
        if (message.channel instanceof TextChannel || message.channel instanceof DMChannel || message.channel instanceof NewsChannel) {
            const botReply = await message.channel.send('У вас недостаточно прав для выполнения этой команды.');
            setTimeout(async () => {
                await botReply.delete();
            }, 60_000);
        }
    }
}


////////////////////////////////////////////////////// { Функция сохроняюшая только новые арты bruhsaver } ////////////////////////////////////////////
export async function DanteAutoArtSaver(client: Client, channelIds: string[], delay: number = 1000, direkt: string) {
  let lastFetchTime = 0;

  const SAVE_DIR = path.join(__dirname, direkt);
  if (!fs.existsSync(SAVE_DIR)) {
    fs.mkdirSync(SAVE_DIR);
  } else {  
  client.on('messageCreate', async (message: Message) => {
    // Проверяем, что сообщение пришло из одного из каналов в массиве и содержит вложения
    if (channelIds.includes(message.channel.id) && message.attachments.size > 0) {
      const currentTime = Date.now();

      // Ограничение частоты запросов
      if (currentTime - lastFetchTime >= delay) {
        lastFetchTime = currentTime;

        for (const attachment of message.attachments.values()) {
          const fileName = attachment.id + attachment.name;
          const response = await fetch(attachment.url);
          const fileStream = fs.createWriteStream(path.join(SAVE_DIR, fileName));
          response.body?.pipe(fileStream);
          console.log(`Файл сохранен: ${fileName}`);
        }
      }
    }
  });
}

  client.on('error', (error) => {
    console.error('Произошла ошибка:', error);
  });
}


/////////////////////////////////////////////////////////// { !!!ИСПОЛЬЗОВАТЬ ТОЛЬКО 1 РАЗ!!! Функция которая сохроняет все арты из определёного канала в определённую дмректорию, saveImageFromCnannle } ///////////////////////////////////////////
export async function saveImagesFromChannel(client: Client, channelId: string, saveDir: string): Promise<void> {
    const channel = await client.channels.fetch(channelId);
    
    if (!channel || !(channel instanceof TextChannel)) {
        console.error('Канал не найден или не является текстовым.');
        return;
    }

    if (!fs.existsSync(saveDir)) {
        fs.mkdirSync(saveDir, { recursive: true });
    }

    let lastMessageId: string | undefined;
    let hasMoreMessages = true;
    let totalImagesSaved = 0;

    while (hasMoreMessages) {
        const messages = await channel.messages.fetch({ limit: 100, before: lastMessageId }) as Collection<string, Message>;

        if (messages.size === 0) {
            hasMoreMessages = false;
            break;
        }

        for (const message of messages.values()) {
            if (message.attachments.size > 0) {
                const imagePromises = message.attachments.map(async (attachment) => {
                    if (attachment.contentType?.startsWith('image/')) {
                        const imageUrl = attachment.url;
                        const response = await fetch(imageUrl);
                        const buffer = (await response.buffer());
                        const arraybuf = buffer.buffer
                        const uint8Array = new Uint8Array(arraybuf);
                        const filePath = path.join(saveDir, attachment.name);

                        return new Promise<void>((resolve, reject) => {
                            fs.writeFile(filePath, uint8Array, (err) => {
                                if (err) {
                                    console.error(`Ошибка при сохранении файла ${attachment.name}:`, err);
                                    reject(err);
                                } else {
                                    totalImagesSaved++;
                                    process.stdout.write(`\rЗагружено изображений: ${totalImagesSaved}`);
                                    resolve();
                                }
                            });
                        });
                    }
                });

                await Promise.all(imagePromises);
            }
        }

        lastMessageId = messages.last()?.id;

        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log(`\nВсего загружено изображений: ${totalImagesSaved}`);
}


///////////////////////////////////////////////////// { Формирование еженедельного отчёта, setupWeeklyReport } /////////////////////////////////////////////////////

const MAX_ARCHIVE_SIZE_MB = 10; // Максимальный размер архива в МБ

// Функция для создания архива
async function createArchive2(sourceDir: string, archivePath: string, filesToArchive: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(archivePath);
        const archive = archiver('zip', {
            zlib: { level: 9 }, // Высокая степень сжатия
        });

        output.on('close', () => resolve());
        archive.on('error', (err) => reject(err));

        archive.pipe(output);

        filesToArchive.forEach((file) => {
            const filePath = path.join(sourceDir, file);
            archive.file(filePath, { name: file });
        });

        archive.finalize();
    });
}

// Функция для деления архива на несколько частей, если его размер превышает 10 МБ
async function splitAndCreateArchives(sourceDir: string, archivePath: string): Promise<string[]> {
    const files = fs.readdirSync(sourceDir);
    let archivePaths: string[] = [];
    let currentPart: string[] = [];
    let currentSize = 0;

    for (let i = 0; i < files.length; i++) {
        const filePath = path.join(sourceDir, files[i]);
        const stats = fs.statSync(filePath);
        currentSize += stats.size;

        // Если добавление файла превышает максимальный размер архива, создаем новый архив
        if (currentSize > MAX_ARCHIVE_SIZE_MB * 1024 * 1024) {
            const partIndex = archivePaths.length + 1;
            const partArchivePath = `${archivePath}_part${partIndex}.zip`;
            await createArchive2(sourceDir, partArchivePath, currentPart);
            archivePaths.push(partArchivePath);

            // Сброс текущей части и размера
            currentPart = [files[i]];
            currentSize = stats.size;
        } else {
            currentPart.push(files[i]);
        }
    }

    // Создание архива для оставшихся файлов
    if (currentPart.length > 0) {
        const partIndex = archivePaths.length + 1;
        const partArchivePath = `${archivePath}_part${partIndex}.zip`;
        await createArchive2(sourceDir, partArchivePath, currentPart);
        archivePaths.push(partArchivePath);
    }

    return archivePaths;
}

export function DanteSetupWeeklyReport(
    client: Client,
    userId: string,
    sourceDir: string,
    archiveName: string
): void {
    const cronExpression = '00 15 * * 5';
    let nextExecutionTime = parser.parseExpression(cronExpression).next().toDate();

    const scheduleNextExecution = () => {
        const now = new Date();
        if (nextExecutionTime <= now) {
            nextExecutionTime = parser.parseExpression(cronExpression).next().toDate();
        }
        const delay = nextExecutionTime.getTime() - now.getTime();

        setTimeout(async () => {
            try {
                const user = await client.users.fetch(userId);
                if (!user) {
                    console.error('Пользователь не найден.');
                    return;
                }

                // Проверяем, какие архивы нужно создать
                const archivePath = path.join(sourceDir, archiveName);
                const archivePaths = await splitAndCreateArchives(sourceDir, archivePath);

                const fileCount = fs.readdirSync(sourceDir).length;

                await user.send(
                    `Привет! На этой неделе было загружено ${fileCount} изображений. Архивы щас скину.`
                );
                
                for (const archive of archivePaths) {
                    await user.send({ files: [archive] });
                }
                console.log("\n#архивы отправлены\n");
                // Очищаем папку и удаляем архивы
                clearDirectory(sourceDir);

                console.log('Еженедельный отчёт успешно отправлен.');
            } catch (err) {
                console.error('Ошибка при отправке еженедельного отчёта:', err);
            } finally {
                nextExecutionTime = parser.parseExpression(cronExpression).next().toDate();
                scheduleNextExecution();
            }
        }, delay);
    };

    scheduleNextExecution();
}



//////////////////////////////////////////////////////// { Реализация команды которая отправляет инфу о боте, handleInfoCommand} //////////////////////////////////////////////////////////////
export async function DanteInformator(message: Message, startDate: Date) {
    const version = '1.3.1';
    const lastUpdate = '2024-12-28';

    const now_time = new Date();
    const uptime = (startDate.getHours() - now_time.getHours()).toString() + " часов";

    const commandsList = `
    "}info" - Показать информацию о боте
    "}ping" - Проверить, онлайн ли бот
    "когда пятница?" - действительно когда?...
    ".гладить" - ....
            **комманды для модерации**
    ||"}chisty" - очишает кол-во сообщений 
    после пробела(только для модеров)
    "}getLogs" - отправляет лог файл в лс.
    "}fetchMedia" - подгружает в библиотеку бота 
    арты за определённое время.||
    `;
    //    "}поставь" - и через пробел указываете ссылку
    //на ютюб.(в разработке)
    //"}пауза" - приостанавливает музыку.
    //"}продолжай" - возобновляет воспроизведение.
    //"}скипай" - пропускает трек.
    // Создаем Embed-сообщение
    const embed = new EmbedBuilder()
        .setTitle('Информация о боте')
        .setColor(0x9834db)
        .setImage('https://cdn.discordapp.com/app-icons/1240895608454385695/1ff43e19cb1aae20d6bf5688839c6cbb.png?size=512')
        .addFields(
            { name: 'Версия бота', value: version, inline: false },
            { name: 'Дата последнего обновления', value: lastUpdate, inline: false },
            { name: 'Доступные команды', value: commandsList, inline: false },
            { name: "Время работы", value: uptime, inline: false },
        )

    if (message.channel instanceof TextChannel || message.channel instanceof DMChannel || message.channel instanceof NewsChannel) {
        await message.channel.send({ embeds: [embed] });
    } else {
        console.error("Канал не поддерживает отправку сообщений.");
    }
}


////////////////////////////////////////////////////// { Функция для отправки сообшений по пятницам и не только sendScheduledMessage } ////////////////////////////////////////////////////////
export async function sendScheduledMessage(client: Client, channelId: string, messageContent: string, filePath: string) {
    const channel = await client.channels.fetch(channelId);

    if (channel instanceof TextChannel) {
        try {
            await channel.send({ content: messageContent, files: [filePath] });
            console.log('Сообщение отправлено успешно!');
        } catch (error) {
            console.error(`Ошибка при отправке сообщения: ${error}`);
        }
    } else {
        console.error('Канал не является текстовым.');
    }
}

export function startScheduledMessage(
    client: Client, 
    channelId: string, 
    messageContent: string, 
    filePath: string,
    time: string, // Время в формате 'HH:mm'
    dayOfWeek: number // День недели: 0 (воскресенье) - 6 (суббота)
) {
    const cronExpression = `${time.split(':')[1]} ${time.split(':')[0]} * * ${dayOfWeek}`;
    const raportExpression = `${"15:00".split(':')[1]} ${"15:00".split(':')[0]} * * ${5}`;

    const task = cron.schedule(cronExpression, () => {
        console.log('Отправка запланированного сообщения...');
        sendScheduledMessage(client, channelId, messageContent, filePath);
    }, {
        timezone: 'Europe/Moscow'
    });

    const spinnerFrames = ['[|]', '[/]', '[-]', '[\\]'];
    let spinnerIndex = 0;

    let lastMessage: string = '';
    setInterval(() => {
        const interval = parser.parseExpression(cronExpression, { tz: 'Europe/Moscow' });
        const nextDate = interval.next().toDate();
        const now = new Date();
        const remainingTime = nextDate.getTime() - now.getTime();

        const days = Math.floor(remainingTime / (1000 * 60 * 60 * 24)); 
        const hours = Math.floor((remainingTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)); // Остаток часов
        const totalHours = days * 24 + hours; // Всего часов, включая дни
        const minutes = Math.floor((remainingTime % (1000 * 60 * 60)) / (1000 * 60)); // Остаток минут
        const seconds = Math.floor((remainingTime % (1000 * 60)) / 1000); // Остаток секунд

        
        const remainingTime2 = parser.parseExpression(raportExpression, { tz: "Europe/Moscow"}).next().toDate().getTime() - now.getTime();

        const days2 = Math.floor(remainingTime2 / (1000 * 60 * 60 * 24)); 
        const hours2 = Math.floor((remainingTime2 % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)); // Остаток часов
        const totalHours2 = days2 * 24 + hours2; // Всего часов, включая дни
        const minutes2 = Math.floor((remainingTime2 % (1000 * 60 * 60)) / (1000 * 60)); // Остаток минут
        const seconds2 = Math.floor((remainingTime2 % (1000 * 60)) / 1000); // Остаток секунд


        const newMessage = `Осталось времени до следуюшего гег-сообшения - ${totalHours.toString().padStart(2, '0')}ч ${minutes.toString().padStart(2, '0')}м ${seconds.toString().padStart(2, '0')}с ${spinnerFrames[spinnerIndex]}  |  До следуюшего отчеёта - ${totalHours2.toString().padStart(2, '0')}ч ${minutes2.toString().padStart(2, '0')}м ${seconds2.toString().padStart(2, '0')}с ${spinnerFrames[spinnerIndex]} `;

        if (lastMessage) {
            process.stdout.write('\r');  // Возвращаем курсор в начало строки
            process.stdout.write(' '.repeat(lastMessage.length)); // Очищаем строку
            process.stdout.write('\r');  // Возвращаем курсор в начало строки
        }

        process.stdout.write(newMessage);
        lastMessage = newMessage;

        spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length; // Цикл по кадрам спиннера
    }, 500); // Обновляем каждые 500 мс
}

export function getTimeUntilFriday(): string {
    const nowUTC = new Date(); // Текущее время по UTC
    const mskOffset = 3 * 60 * 60 * 1000; // Смещение для MSK (UTC+3)
    const nowMSK = new Date(nowUTC.getTime() + mskOffset); // Текущее время по MSK

    const daysUntilFriday = (5 - nowMSK.getUTCDay() + 7) % 7; // 5 = пятница
    const nextFriday = new Date(nowMSK.getTime() + daysUntilFriday * 24 * 60 * 60 * 1000);
    nextFriday.setHours(10, 0, 0, 0); // Устанавливаем 10:00 по MSK

    // Если сейчас пятница до 10:00, считать, что время до следующей пятницы
    if (daysUntilFriday === 0 && nowMSK.getHours() < 10) {
        nextFriday.setTime(nextFriday.getTime() + 7 * 24 * 60 * 60 * 1000); // Добавить 7 дней
    }

    const timeDifference = nextFriday.getTime() - nowMSK.getTime();
    const totalSeconds = Math.floor(timeDifference / 1000);
    const hours = Math.floor(totalSeconds / 3600); // 3600 секунд в часе
    const minutes = Math.floor((totalSeconds % 3600) / 60); // Остаток минут
    const seconds = totalSeconds % 60; // Остаток секунд

    return `Скоро:
     ${hours} часов ${minutes} минут ${seconds} секунд`;
}


////////////////////////////////////////////// { Функция удаления сообшений } ////////////////////////////////////
export async function DanteMessageClener(message: Message): Promise<number> {
    if (message.author.bot) return 0;

    const args = message.content.split(' ');

    const amount = parseInt(args[1], 10);
    if (isNaN(amount) || amount < 1 || amount > 300) {
        await sendMessageAfterDelet(message.channel, 'Укажите количество сообщений для удаления (от 1 до 300).');
        return 0; 
    }

    const member = message.member as GuildMember;
    if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
        await sendMessageAfterDelet(message.channel, 'У вас нет разрешения на удаление сообщений.');
        return 0;
    }

    if (message.channel instanceof TextChannel) {
        try {
            console.log(`Удаляем ${amount} сообщений из канала ${message.channel.name}`);

            const fetchedMessages = await message.channel.messages.fetch({ limit: amount });
            const deletedMessages = await message.channel.bulkDelete(fetchedMessages, true);

            console.log(`Удалено сообщений: ${deletedMessages.size}`);

            const responseMessage = await sendMessageAfterDelet(message.channel, `Удалено ${deletedMessages.size} сообщений.<:literally1984:1286290240633442425>`);

            if (responseMessage) {
                setTimeout(async () => {
                    await responseMessage.delete();
                }, 5000);
            }

            return deletedMessages.size;
        } catch (error) {
            console.error('Ошибка при удалении сообщений:', error);
            await sendMessageAfterDelet(message.channel, 'Произошла ошибка при удалении сообщений.');
            return 0;
        }
    } else {
        await sendMessageAfterDelet(message.channel, 'Эта команда доступна только в текстовых каналах.');
        return 0;
    }
}


////////////////////////////////////////// [ ПОБОЧНЫЕ ФУНКЦИИ] ///////////////////////////////////////////////////////
export async function sendMessageAfterDelet(channel: Channel, content: string, a_flag?: number): Promise<Message | null> {
    if (channel instanceof TextChannel) {
        const dotmessage = await channel.send(content);
        if (a_flag === 1) {
            setTimeout(async () => {
                await dotmessage.delete();
            }, 10_000
            );
        }
        return dotmessage;
    }
    return null;
}

// Функция для проверки, может ли канал отправлять сообщения
export function canSendMessages(channel: any): boolean {
    return channel.type === ChannelType.GuildText || 
           channel.type === ChannelType.DM || 
           channel.type === ChannelType.GuildAnnouncement || 
           channel.type === ChannelType.PublicThread || 
           channel.type === ChannelType.PrivateThread;
}

export async function createArchive(sourceDir: string, outputFile: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outputFile);
        const archive = archiver('zip', {
            zlib: { level: 9 },
        });

        output.on('close', () => resolve());
        archive.on('error', (err) => reject(err));

        archive.pipe(output);
        archive.directory(sourceDir, false);
        archive.finalize();
    });
}

export function clearDirectory(directory: string): void {
    if (fs.existsSync(directory)) {
        const files = fs.readdirSync(directory);
        for (const file of files) {
            fs.unlinkSync(path.join(directory, file));
        }
    }
}

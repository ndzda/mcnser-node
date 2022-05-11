/**
 * 自定义连接放行判定
 * 传递true放行 否则断开
 * @async
 * @param {string} userName
 * @returns {Promise<boolean>}
 */
export function userCmp(userName)
{
    return new Promise((resolve) => // 请不要reject此Promise
    {
        console.log(userName);
        resolve(true);
    });
}
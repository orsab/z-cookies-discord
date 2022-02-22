const fs = require("fs");
const DB_FILE = "./database.db";
const Database = require("sqlite-async");

const DB = () => {
  let db;

  const getMember = async (memberId) => {
    const member = await db.get(`SELECT * FROM members WHERE id = $id`, {
      $id: memberId,
    });

    return member;
  };
  const linkMember = async (memberId, address) => {
    console.log(address)
    const member = await getMember(memberId);

    if (member) {
      await db.run(`UPDATE members SET address = $address WHERE id = $id`, {
        $address: address,
        $id: memberId,
      });
    } else {
      await db.run(`INSERT INTO members (id,address) VALUES(?,?)`, [
        memberId,
        address,
      ]);
    }

    return await getMember(memberId)
  };
  const buyPackage = async (memberId, cost) => {
    const member = await getMember(memberId);

    console.log(Number(member.balance)+0.1,  Number(cost))

    if(Number(member.balance) + 0.1 < Number(cost)){
      throw new Error('Not enough balance')
    }

    if (member) {
      await db.run(`UPDATE members SET balance = balance - $cost WHERE id = $id`, {
        $cost: Number(cost),
        $id: memberId,
      });
    } else {
      throw new Error('Member not exists')
    }
  };

  const depositBalance = async (memberId, amount) => {
    const member = await getMember(memberId);

    if (member) {
      await db.run(`UPDATE members SET balance = balance + $amount WHERE id = $id`, {
        $amount: Number(amount),
        $id: memberId,
      });
    } else {
      throw new Error('Member not exists')
    }
  };

  const initDb = async () => {
    let isExist = true;

    if (!fs.existsSync(DB_FILE)) {
      isExist = false;
    }
    db = await Database.open(DB_FILE);

    if (!isExist) {
      await db.run(`
          CREATE TABLE IF NOT EXISTS members(
              id NVARCHAR(20) PRIMARY KEY NOT NULL,
              address NVARCHAR(70),
              balance REAL DEFAULT 0
              );
              `);
      // await db.run(`
      //           CREATE UNIQUE INDEX members ON members(username);
      //           `);
    }

    return db;
  };

  return {
    initDb,
    getMember,
    linkMember,
    buyPackage,
    depositBalance
  };
};

module.exports = DB

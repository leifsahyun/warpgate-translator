const jwt = require('jsonwebtoken');

const configuration = {
  currentAccessCode: process.env.WARPGATE_ACCESS_CODE,
  jwtSecret: process.env.WARPGATE_SECRET
};

export default async function (req, res) {
	var inputAccessCode = req.body.accessCode;
	console.log("triggered with access code "+inputAccessCode);
	if(configuration.currentAccessCode != inputAccessCode)
	{
		res.status(401).send("Incorrect access code");
		return;
	}
	var jwtToken = jwt.sign({ accessCode: inputAccessCode }, configuration.jwtSecret, {expiresIn: "1h"});
	res.status(200).json({ token: jwtToken });
}
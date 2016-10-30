# logic functions
## user

###getUser
	In: userName
	Out: IdentityId or 'not found'
###changeEmail
	In: emailAddress, IdentityId
	Out: Success/Fail
###verifyEmail
	In: emailAddress, activationKey
	Out: Success/Fail
###createToken
	In: Credit Card info (TBD)
	Out: Tokenized card or fail
###chargeToken
	In: ccToken
	Out: receipt or fail
###changePhone
	In: phoneNumber, IdentityId
	Out: Success/Fail
###verifyPhone
	In: phoneNumber, pinCode
	Out: Success/Fail

## drip GET

###getDrip
	In: TBD
	Out: TBD
###getRecent
	In: TBD
	Out: IdentityId or 'not found'
###getCreated
	In: TBD
	Out: IdentityId or 'not found'
###getPurchased
	In: TBD
	Out: IdentityId or 'not found'
###getRated
	In: TBD
	Out: IdentityId or 'not found'
## drip POST
###createDrip
	In: TBD
	Out: IdentityId or 'not found'
###removeDrip
	In: TBD
	Out: IdentityId or 'not found'
###changeRating
	In: TBD
	Out: IdentityId or 'not found'
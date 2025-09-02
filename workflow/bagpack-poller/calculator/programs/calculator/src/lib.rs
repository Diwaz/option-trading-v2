use anchor_lang::prelude::*;

declare_id!("BKRwLugQoZphBZr1aThVXo8rnxMFZXjsq384tKsnnvZb");

#[program]
pub mod calculator {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

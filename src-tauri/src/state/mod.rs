use crate::ipc::types::SensorTick;
use std::sync::RwLock;
use tokio::sync::mpsc::Sender;

pub enum PollerMsg {
    SetInterval(u32),
}

#[derive(Clone)]
pub struct PollerHandle {
    pub tx: Sender<PollerMsg>,
}

pub struct AppState {
    pub poller: PollerHandle,
    pub last_tick: RwLock<Option<SensorTick>>,
}
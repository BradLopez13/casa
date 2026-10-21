import { createContext, useContext } from 'react';

/** Whether a notice pill is on screen; lists read it to leave room at their end. */
export const NoticeShownContext = createContext(false);

export const useNoticeShown = () => useContext(NoticeShownContext);

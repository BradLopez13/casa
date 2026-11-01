import { createContext, useContext } from 'react';

/** Whether a notice pill is on screen; lists read it to leave room at their end. */
export const NoticeShownContext = createContext(false);

export const useNoticeShown = () => useContext(NoticeShownContext);

/**
 * Whether the notice on screen speaks of a note still in the list, which the list may move to
 * uncover (`useNoticeNudge`). False for one whose note left it, to the tray or deleted: nothing to
 * uncover, so the list stays where it is (decisión 1 de Brad, 27 de octubre).
 */
export const NoticeNudgesContext = createContext(false);

export const useNoticeNudges = () => useContext(NoticeNudgesContext);

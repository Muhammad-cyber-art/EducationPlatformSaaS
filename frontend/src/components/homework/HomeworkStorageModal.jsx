import React from"react";
import { createPortal } from"react-dom";
import { useHomeworkStorage } from"./Storage/useHomeworkStorage";
import { 
 StorageHeader, StorageSidebar, StorageDetails 
} from"./Storage/StorageComponents";

const HomeworkStorageModal = ({ isOpen, onClose, groupId }) => {
 const {
 selectedHomework, setSelectedHomework, searchTerm, setSearchTerm,
 isLoading, handleClearAll, filteredItems, getStatusColor
 } = useHomeworkStorage(isOpen, groupId);

 if (!isOpen) return null;

 return createPortal(
 <div className="fixed inset-0 z-[2001] flex items-center justify-center p-4 sm:p-6 overflow-y-auto pt-16 sm:pt-4">
 <div
 className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
 onClick={onClose}
 />

 <div className="relative bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-[1.5rem] md:rounded-[2.5rem] shadow-2xl w-full max-w-5xl h-[90vh] md:h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
 <StorageHeader onClearAll={handleClearAll} onClose={onClose} />
 
 <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
 <StorageSidebar 
 searchTerm={searchTerm} 
 setSearchTerm={setSearchTerm} 
 isLoading={isLoading} 
 filteredItems={filteredItems} 
 selectedHomework={selectedHomework} 
 onSelect={setSelectedHomework} 
 />

 <StorageDetails 
 selectedHomework={selectedHomework} 
 onBack={() => setSelectedHomework(null)} 
 getStatusColor={getStatusColor} 
 />
 </div>
 </div>
 </div>,
 document.body
 );
};

export default HomeworkStorageModal;

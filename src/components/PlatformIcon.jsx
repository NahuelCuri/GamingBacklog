
import React from 'react';

const PlatformIcon = ({ platform, className }) => {
    // Always return the generic icon as requested ("no emojis")
    return (
        <div className={`${className} flex items-center justify-center`}>
            <span className="material-symbols-outlined" style={{ fontSize: 'inherit' }}>videogame_asset</span>
        </div>
    );
};

export default PlatformIcon;

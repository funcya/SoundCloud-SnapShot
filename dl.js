function Download(user_id)
{
	this.user_id = user_id;
	this.req = null;
	this.onFinished = null;
	this.tracks = [];
	this.logString = "";
}

Download.prototype = {

	log : function(line)
	{
		this.logString += line +"\n";
	},

	buildTrackIdsFromJSON : function(jsonResponse)
	{		
		this.tracks = this.extractTracksRec(jsonResponse.collection);
		this.onTrackListReady()
	},

	downloadTracks : function(targetDirectory)
	{
		this.targetDirectory = targetDirectory;
		this.downloadTracksRec(this.tracks);
	},

	downloadTracksRec : function(list)
	{
		var node;
		for(key in list)
		{
			node = list[key];
			if(node.type == "track" && node.selected)
				this.downloadTrack(node);
			else if(node.type == "list" && node.selected)
				this.downloadTracksRec(node.list);
		}
	},

	downloadTrack : function(track)
	{
		if(track.dl_mode == "download")
		{
			this.createDownload({"http_mp3_128_url" : "https://api.soundcloud.com/tracks/"+track.id+"/download?client_id=b45b1aa10f1ac2941910a7f0d10f8e28"}, track);
		}
		else if(track.dl_mode == "stream")
		{
			track.req = new XMLHttpRequest();
			track.req.onreadystatechange = function(){
				if(track.req.readyState == 4) this.createDownload(JSON.parse(track.req.responseText), track);
			}.bind(this);
			track.req.open( "GET", "https://api.soundcloud.com/i1/tracks/"+track.id+"/streams?client_id=b45b1aa10f1ac2941910a7f0d10f8e28&app_version=cefbe6b", true);
			track.req.send( null );
		}
		else
			this.log("Skipped Track (track not for download or streaming): " + track.name)		
	},

	createDownload : function(json, track)
	{
		if( ! (url = json["http_mp3_128_url"]) )
		{
			this.log("Skipped Track (track not available as http-download): " + track.name);
			return;
		}
	
		chrome.runtime.sendMessage({
			download_url : url,
			action : "soundcloud_snapshot_download",
			filename : this.targetDirectory + track.name.replace( /[<>:"\/\\|?*]+/g, '' ) + ".mp3"
		}, function(downloadId){
			if(!downloadId)	
				console.log("Skipped Track (track download-url doesn't work): " + track.name + " url: "+ url);				
		}.bind(this));
	},

	extractTracksRec : function(inList, isPlaylist)
	{
		var key, node, track, entry, outList = [];
		for(key in inList)
		{
			node = inList[key];
			if(node.type == "track-repost" || node.type == "track" || isPlaylist)
			{
				track = isPlaylist ? node : node.track;
				outList.push({	
					type : "track",
					id : track.id,
					name : track.title,
					dl_mode : this.lookupUrl(track),
					selected : true
				});
			}
			else if(node.type == "playlist-repost" ||  node.type == "playlist")
				outList.push({
					type : "list",
					name : node.playlist.title,
					list : this.extractTracksRec(node.playlist.tracks, true),
					selected : false
				});
		}
		return outList;
	},

	lookupUrl : function(track)
	{
		if(track.downloadable)
			return "download";
		else if(track.streamable)
			return "stream";
		else 
			return "unavailable";
	},

	getTrackIdsAsync : function(callback)
	{
		this.onTrackListReady = callback;
		this.req = new XMLHttpRequest();
		this.req.onreadystatechange = function(){
			if(this.req.readyState == 4) this.buildTrackIdsFromJSON(JSON.parse(this.req.responseText));
		}.bind(this);
		this.req.open( "GET", "https://api-v2.soundcloud.com/profile/soundcloud%3Ausers%3A"+this.user_id+"?limit=50&offset=0&linked_partitioning=1", true);
		this.req.send( null );
	},

	clearSelection : function(state)
	{
		this.clearSelectionRec(this.tracks, state);
	},

	clearSelectionRec : function(list, state)
	{
		var i;
		for(i = 0; i < list.length; i++)
		{
			list[i].selected = state;
			if(list[i].type == "list")
				this.clearSelectionRec(list[i].list, state);
		}
	}
}

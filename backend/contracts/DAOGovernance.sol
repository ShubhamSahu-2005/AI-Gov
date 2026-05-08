// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DAOGovernance {

    struct Proposal {
        uint id;
        address creator;
        string ipfsHash;
        uint votesFor;
        uint votesAgainst;
        bool executed;
    }

    uint public proposalCount;
    mapping(uint => Proposal) public proposals;

    event ProposalCreated(uint id, address creator, string ipfsHash);
    event VoteCast(uint proposalId, address voter, bool support);

    function createProposal(string memory ipfsHash) public {
        proposalCount++;

        proposals[proposalCount] = Proposal({
            id: proposalCount,
            creator: msg.sender,
            ipfsHash: ipfsHash,
            votesFor: 0,
            votesAgainst: 0,
            executed: false
        });

        emit ProposalCreated(proposalCount, msg.sender, ipfsHash);
    }

    function vote(uint proposalId, bool support) public {
        Proposal storage p = proposals[proposalId];

        require(!p.executed, "Already executed");

        if (support) {
            p.votesFor++;
        } else {
            p.votesAgainst++;
        }

        emit VoteCast(proposalId, msg.sender, support);
    }

    function getProposal(uint id) public view returns (Proposal memory) {
        return proposals[id];
    }
}